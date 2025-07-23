import ApiKey from '../models/ApiKey.js';
import { securityUtils } from '../utils/security.js';
import { Database } from '../config/database.js';

// API Key authentication middleware
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);
    
    if (!apiKey) {
      // If no API key, fall back to JWT auth
      return next();
    }

    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      await logInvalidApiKey(req, 'Invalid API key format');
      return res.status(401).json({
        error: 'Invalid API key format'
      });
    }

    // Find API key in database
    const keyData = await ApiKey.findByKey(apiKey);
    
    if (!keyData) {
      await logInvalidApiKey(req, 'API key not found');
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }

    // Check if key is expired
    if (keyData.isExpired()) {
      await logInvalidApiKey(req, 'API key expired', keyData.user_id);
      return res.status(401).json({
        error: 'API key has expired'
      });
    }

    // Update last used timestamp
    await keyData.updateLastUsed();

    // Add API key data to request
    req.apiKey = keyData;
    req.user = {
      id: keyData.user_id,
      role: keyData.user_role,
      isApiKey: true
    };

    // Log successful API key usage
    await securityUtils.logSecurityEvent({
      type: 'api_key_used',
      severity: 'info',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: keyData.user_id,
      details: {
        keyId: keyData.id,
        keyName: keyData.name
      }
    });

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

// Extract API key from request
function extractApiKey(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer sk_')) {
    return authHeader.split(' ')[1];
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check query parameter (not recommended for production)
  if (req.query.api_key) {
    return req.query.api_key;
  }

  return null;
}

// Validate API key format
function isValidApiKeyFormat(apiKey) {
  // Must start with sk_ and be at least 40 characters
  return apiKey && apiKey.startsWith('sk_') && apiKey.length >= 40;
}

// Log invalid API key attempt
async function logInvalidApiKey(req, reason, userId = null) {
  await securityUtils.logSecurityEvent({
    type: 'invalid_api_key',
    severity: 'warning',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId,
    details: { reason }
  });
}

// Combined authentication middleware (JWT or API Key)
export const authenticateJwtOrApiKey = async (req, res, next) => {
  // Try API key authentication first
  const apiKey = extractApiKey(req);
  
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // Fall back to JWT authentication
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer sk_')) {
    // Use the existing JWT authenticate middleware
    const { authenticate } = await import('./auth.js');
    return authenticate(req, res, next);
  }

  // No authentication provided
  return res.status(401).json({
    error: 'Authentication required. Provide JWT token or API key.'
  });
};

// Check API key permissions middleware
export const requireApiKeyPermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      // If not using API key, skip this check
      return next();
    }

    if (!req.apiKey.hasPermission(permission)) {
      return res.status(403).json({
        error: `API key lacks required permission: ${permission}`
      });
    }

    next();
  };
};

// API key rate limiting middleware
export const apiKeyRateLimit = async (req, res, next) => {
  if (!req.apiKey) {
    // If not using API key, skip this check
    return next();
  }

  const keyId = req.apiKey.id;
  const limit = req.apiKey.rate_limit;
  const windowMs = 60 * 60 * 1000; // 1 hour window

  try {
    // Get current usage count
    const sql = `
      SELECT COUNT(*) as count 
      FROM api_key_usage 
      WHERE key_id = ? AND created_at > datetime('now', '-1 hour')
    `;
    
    const result = await Database.get(sql, [keyId]);
    const currentUsage = result.count;

    if (currentUsage >= limit) {
      // Log rate limit exceeded
      await securityUtils.logSecurityEvent({
        type: 'api_key_rate_limit_exceeded',
        severity: 'warning',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.apiKey.user_id,
        details: {
          keyId,
          limit,
          currentUsage
        }
      });

      return res.status(429).json({
        error: 'API key rate limit exceeded',
        limit,
        windowMs,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Log usage
    await Database.run(
      'INSERT INTO api_key_usage (key_id, endpoint, ip_address) VALUES (?, ?, ?)',
      [keyId, req.originalUrl, req.ip]
    );

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': limit - currentUsage - 1,
      'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
    });

    next();
  } catch (error) {
    console.error('API key rate limit check failed:', error);
    next(); // Don't block on error
  }
};

// Initialize API key tables
export const initializeApiKeyTables = async () => {
  try {
    // API keys table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        permissions TEXT DEFAULT '[]',
        rate_limit INTEGER DEFAULT 1000,
        expires_at DATETIME,
        last_used_at DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // API key usage tracking table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER NOT NULL,
        endpoint VARCHAR(255),
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await Database.run('CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(key_id)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at)');

    console.log('API key tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize API key tables:', error);
  }
};

// Clean up old API key usage records
export const cleanupApiKeyUsage = async () => {
  try {
    const result = await Database.run(
      'DELETE FROM api_key_usage WHERE created_at < datetime("now", "-7 days")'
    );
    console.log(`Cleaned up ${result.changes} old API key usage records`);
  } catch (error) {
    console.error('Failed to cleanup API key usage:', error);
  }
};

// Start cleanup interval
setInterval(cleanupApiKeyUsage, 24 * 60 * 60 * 1000); // Daily cleanup