import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Database } from '../config/database.js';

// Security utilities for authentication
export const securityUtils = {
  // Generate secure random tokens
  generateSecureToken: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },

  // Generate password reset token
  generateResetToken: () => {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  },

  // Hash sensitive data
  hashData: (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  // Generate CSRF token
  generateCSRFToken: () => {
    return crypto.randomBytes(32).toString('base64');
  },

  // Validate JWT token structure without verification
  isValidJWTStructure: (token) => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3;
  },

  // Extract JWT payload without verification (for logging/debugging)
  extractJWTPayload: (token) => {
    try {
      if (!securityUtils.isValidJWTStructure(token)) return null;
      const payload = token.split('.')[1];
      return JSON.parse(Buffer.from(payload, 'base64').toString());
    } catch (error) {
      return null;
    }
  },

  // Check if IP is in whitelist/blacklist
  checkIPRestrictions: async (ip) => {
    try {
      // Check if IP is blacklisted
      const blacklisted = await Database.get(
        'SELECT * FROM ip_blacklist WHERE ip_address = ? AND expires_at > datetime("now")',
        [ip]
      );
      
      if (blacklisted) {
        return { allowed: false, reason: 'IP blacklisted' };
      }

      // Check if IP is whitelisted (optional feature)
      const whitelistEnabled = process.env.IP_WHITELIST_ENABLED === 'true';
      if (whitelistEnabled) {
        const whitelisted = await Database.get(
          'SELECT * FROM ip_whitelist WHERE ip_address = ?',
          [ip]
        );
        
        if (!whitelisted) {
          return { allowed: false, reason: 'IP not whitelisted' };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('IP restriction check failed:', error);
      return { allowed: true }; // Allow on error to prevent blocking
    }
  },

  // Blacklist IP address
  blacklistIP: async (ip, reason, durationHours = 24) => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      await Database.run(
        `INSERT OR REPLACE INTO ip_blacklist (ip_address, reason, expires_at)
         VALUES (?, ?, ?)`,
        [ip, reason, expiresAt.toISOString()]
      );

      return true;
    } catch (error) {
      console.error('Failed to blacklist IP:', error);
      return false;
    }
  },

  // Log security events
  logSecurityEvent: async (event) => {
    try {
      const {
        type,
        severity = 'info',
        ip,
        userAgent,
        userId = null,
        details = {},
        timestamp = new Date().toISOString()
      } = event;

      await Database.run(
        `INSERT INTO security_logs (type, severity, ip_address, user_agent, user_id, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [type, severity, ip, userAgent, userId, JSON.stringify(details), timestamp]
      );

      // Log to console for immediate visibility
      console.log(`[SECURITY] ${severity.toUpperCase()} - ${type}: ${JSON.stringify(details)}`);

      return true;
    } catch (error) {
      console.error('Failed to log security event:', error);
      return false;
    }
  },

  // Validate password strength
  validatePasswordStrength: (password) => {
    const minLength = 8;
    const maxLength = 128;
    
    const checks = {
      length: password.length >= minLength && password.length <= maxLength,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[@$!%*?&]/.test(password),
      noCommonPatterns: !/(123456|password|qwerty)/i.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;
    const strength = score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';

    return {
      valid: checks.length && checks.lowercase && checks.uppercase && checks.numbers,
      strength,
      score,
      checks
    };
  },

  // Sanitize user input
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .trim()
      .replace(/[<>"'&]/g, (match) => {
        const map = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return map[match];
      });
  },

  // Generate device fingerprint
  generateDeviceFingerprint: (req) => {
    const components = [
      req.ip,
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || ''
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  },

  // Check for suspicious login patterns
  detectSuspiciousLogin: async (userId, req) => {
    try {
      const deviceFingerprint = securityUtils.generateDeviceFingerprint(req);
      const ip = req.ip;
      const userAgent = req.get('User-Agent');
      
      // Check recent logins
      const recentLogins = await Database.query(
        `SELECT * FROM login_history 
         WHERE user_id = ? AND created_at > datetime('now', '-24 hours')
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );

      const suspiciousFactors = [];

      // Check for new device
      const knownDevice = recentLogins.some(login => 
        login.device_fingerprint === deviceFingerprint
      );
      if (!knownDevice) {
        suspiciousFactors.push('new_device');
      }

      // Check for new IP
      const knownIP = recentLogins.some(login => login.ip_address === ip);
      if (!knownIP) {
        suspiciousFactors.push('new_ip');
      }

      // Check for unusual timing (multiple logins in short time)
      const recentCount = recentLogins.filter(login => 
        new Date(login.created_at) > new Date(Date.now() - 60 * 60 * 1000) // last hour
      ).length;
      if (recentCount > 3) {
        suspiciousFactors.push('frequent_logins');
      }

      // Store login history
      await Database.run(
        `INSERT INTO login_history (user_id, ip_address, user_agent, device_fingerprint, suspicious_factors)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, ip, userAgent, deviceFingerprint, JSON.stringify(suspiciousFactors)]
      );

      return {
        suspicious: suspiciousFactors.length > 0,
        factors: suspiciousFactors,
        riskScore: Math.min(suspiciousFactors.length * 25, 100)
      };
    } catch (error) {
      console.error('Suspicious login detection failed:', error);
      return { suspicious: false, factors: [], riskScore: 0 };
    }
  }
};

// Initialize security tables
export const initializeSecurityTables = async () => {
  try {
    // IP blacklist table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS ip_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address VARCHAR(45) NOT NULL,
        reason TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ip_address)
      )
    `);

    // IP whitelist table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS ip_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address VARCHAR(45) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ip_address)
      )
    `);

    // Security logs table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        user_id INTEGER,
        details TEXT,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Login history table
    await Database.run(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        device_fingerprint VARCHAR(64),
        suspicious_factors TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await Database.run('CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip_address)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_ip_blacklist_expires ON ip_blacklist(expires_at)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_security_logs_type ON security_logs(type)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at)');

    console.log('Security tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize security tables:', error);
  }
};

// Clean up expired security data
export const cleanupSecurityData = async () => {
  try {
    // Clean expired IP blacklist entries
    const blacklistResult = await Database.run(
      'DELETE FROM ip_blacklist WHERE expires_at <= datetime("now")'
    );
    
    // Clean old security logs (keep 90 days)
    const logsResult = await Database.run(
      'DELETE FROM security_logs WHERE created_at < datetime("now", "-90 days")'
    );
    
    // Clean old login history (keep 30 days)
    const historyResult = await Database.run(
      'DELETE FROM login_history WHERE created_at < datetime("now", "-30 days")'
    );

    console.log(`Security cleanup completed: ${blacklistResult.changes + logsResult.changes + historyResult.changes} records cleaned`);
  } catch (error) {
    console.error('Security data cleanup failed:', error);
  }
};

// Start cleanup interval (once per day)
setInterval(cleanupSecurityData, 24 * 60 * 60 * 1000);
