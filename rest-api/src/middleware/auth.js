import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Database } from '../config/database.js';
import { securityUtils } from '../utils/security.js';

// JWT Authentication middleware with enhanced security
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    
    // Check IP restrictions
    const ipCheck = await securityUtils.checkIPRestrictions(ip);
    if (!ipCheck.allowed) {
      await securityUtils.logSecurityEvent({
        type: 'blocked_ip_access',
        severity: 'warning',
        ip,
        userAgent,
        details: { reason: ipCheck.reason }
      });
      
      return res.status(403).json({
        error: 'Access denied from this IP address.'
      });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await securityUtils.logSecurityEvent({
        type: 'missing_auth_header',
        severity: 'info',
        ip,
        userAgent
      });
      
      return res.status(401).json({
        error: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    // Validate token structure before verification
    if (!securityUtils.isValidJWTStructure(token)) {
      await securityUtils.logSecurityEvent({
        type: 'invalid_token_structure',
        severity: 'warning',
        ip,
        userAgent
      });
      
      return res.status(401).json({
        error: 'Invalid token format.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.is_active) {
      await securityUtils.logSecurityEvent({
        type: 'invalid_user_token',
        severity: 'warning',
        ip,
        userAgent,
        userId: decoded.userId,
        details: { userExists: !!user, userActive: user?.is_active }
      });
      
      return res.status(401).json({
        error: 'Invalid token. User not found or inactive.'
      });
    }

    // Check for suspicious activity
    const suspiciousActivity = await securityUtils.detectSuspiciousLogin(user.id, req);
    if (suspiciousActivity.suspicious && suspiciousActivity.riskScore > 75) {
      await securityUtils.logSecurityEvent({
        type: 'suspicious_auth_activity',
        severity: 'warning',
        ip,
        userAgent,
        userId: user.id,
        details: {
          factors: suspiciousActivity.factors,
          riskScore: suspiciousActivity.riskScore
        }
      });
      
      // Could implement additional verification here (2FA, email confirmation, etc.)
    }

    // Add user and security context to request object
    req.user = user;
    req.securityContext = {
      deviceFingerprint: securityUtils.generateDeviceFingerprint(req),
      riskScore: suspiciousActivity.riskScore
    };
    
    next();
  } catch (error) {
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    
    if (error.name === 'JsonWebTokenError') {
      await securityUtils.logSecurityEvent({
        type: 'jwt_verification_failed',
        severity: 'warning',
        ip,
        userAgent,
        details: { error: error.message }
      });
      
      return res.status(401).json({
        error: 'Invalid token.'
      });
    } else if (error.name === 'TokenExpiredError') {
      await securityUtils.logSecurityEvent({
        type: 'token_expired',
        severity: 'info',
        ip,
        userAgent
      });
      
      return res.status(401).json({
        error: 'Token expired.'
      });
    } else {
      await securityUtils.logSecurityEvent({
        type: 'auth_error',
        severity: 'error',
        ip,
        userAgent,
        details: { error: error.message }
      });
      
      return res.status(500).json({
        error: 'Authentication failed.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    
    if (user && user.is_active) {
      req.user = user;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // On any error, just set user to null and continue
    req.user = null;
    next();
  }
};

// Admin authorization middleware
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required.'
    });
  }

  next();
};

// Resource ownership middleware
export const requireOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required.'
        });
      }

      const resourceId = req.params.id;
      let resource;

      switch (resourceType) {
        case 'post':
          const Post = (await import('../models/Post.js')).default;
          resource = await Post.findById(resourceId);
          break;
        case 'comment':
          const Comment = (await import('../models/Comment.js')).default;
          resource = await Comment.findById(resourceId);
          break;
        case 'user':
          resource = await User.findById(resourceId);
          break;
        default:
          return res.status(400).json({
            error: 'Invalid resource type.'
          });
      }

      if (!resource) {
        return res.status(404).json({
          error: `${resourceType} not found.`
        });
      }

      // Check ownership or admin privileges
      const isOwner = resource.author_id === req.user.id || resource.id === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: 'Access denied. You can only modify your own resources.'
        });
      }

      // Add resource to request for use in route handler
      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Authorization check failed.',
        details: error.message
      });
    }
  };
};

// Generate JWT tokens with enhanced security
export const generateTokens = (user, additionalClaims = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const jti = securityUtils.generateSecureToken(16); // Unique token ID
  
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    iat: now,
    jti,
    ...additionalClaims
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'stellarflow-api',
      audience: 'stellarflow-client'
    }
  );

  const refreshPayload = {
    userId: user.id,
    type: 'refresh',
    iat: now,
    jti: securityUtils.generateSecureToken(16)
  };

  const refreshToken = jwt.sign(
    refreshPayload,
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'stellarflow-api',
      audience: 'stellarflow-client'
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    tokenId: jti
  };
};

// Store refresh token in database
export const storeRefreshToken = async (userId, refreshToken) => {
  try {
    // Calculate expiration date
    const expiresAt = new Date();
    const expiryDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN?.replace('d', '')) || 7;
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const sql = `
      INSERT INTO refresh_tokens (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `;

    await Database.run(sql, [refreshToken, userId, expiresAt.toISOString()]);
    return true;
  } catch (error) {
    throw new Error(`Failed to store refresh token: ${error.message}`);
  }
};

// Verify refresh token with enhanced security
export const verifyRefreshToken = async (refreshToken, req = null) => {
  try {
    // First verify JWT signature and structure
    if (!securityUtils.isValidJWTStructure(refreshToken)) {
      return null;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
      issuer: 'stellarflow-api',
      audience: 'stellarflow-client'
    });

    // Check token type
    if (decoded.type !== 'refresh') {
      return null;
    }

    // Check if token exists in database and is not expired
    const sql = `
      SELECT rt.*, u.id, u.username, u.email, u.role, u.is_active
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token = ? AND rt.expires_at > datetime('now') AND u.is_active = 1
    `;

    const tokenData = await Database.get(sql, [refreshToken]);
    
    if (!tokenData) {
      if (req) {
        await securityUtils.logSecurityEvent({
          type: 'invalid_refresh_token',
          severity: 'warning',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: decoded.userId
        });
      }
      return null;
    }

    // Additional security check: verify user ID matches
    if (decoded.userId !== tokenData.id) {
      if (req) {
        await securityUtils.logSecurityEvent({
          type: 'refresh_token_user_mismatch',
          severity: 'error',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: decoded.userId,
          details: { dbUserId: tokenData.id }
        });
      }
      return null;
    }
    
    return {
      id: tokenData.id,
      username: tokenData.username,
      email: tokenData.email,
      role: tokenData.role
    };
  } catch (error) {
    if (req) {
      await securityUtils.logSecurityEvent({
        type: 'refresh_token_verification_error',
        severity: 'warning',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: { error: error.message }
      });
    }
    return null;
  }
};

// Remove refresh token
export const removeRefreshToken = async (refreshToken) => {
  try {
    const sql = 'DELETE FROM refresh_tokens WHERE token = ?';
    await Database.run(sql, [refreshToken]);
    return true;
  } catch (error) {
    throw new Error(`Failed to remove refresh token: ${error.message}`);
  }
};

// Clean expired refresh tokens
export const cleanExpiredTokens = async () => {
  try {
    const sql = "DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')";
    const result = await Database.run(sql);
    return result.changes;
  } catch (error) {
    throw new Error(`Failed to clean expired tokens: ${error.message}`);
  }
};

// Authorization middleware to check user roles
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};