import { Database } from '../config/database.js';
import { securityUtils } from './security.js';
import crypto from 'crypto';

// Session management utilities
export const sessionManagement = {
  // Create a new session
  createSession: async (userId, req, additionalData = {}) => {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const deviceFingerprint = securityUtils.generateDeviceFingerprint(req);
    
    const sessionData = {
      sessionId,
      userId,
      deviceFingerprint,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...additionalData
    };

    const sql = `
      INSERT INTO user_sessions (
        session_id, user_id, device_fingerprint, ip_address, 
        user_agent, data, last_activity
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    try {
      await Database.run(sql, [
        sessionId,
        userId,
        deviceFingerprint,
        req.ip,
        req.get('User-Agent'),
        JSON.stringify(sessionData)
      ]);

      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  },

  // Get session data
  getSession: async (sessionId) => {
    const sql = `
      SELECT * FROM user_sessions 
      WHERE session_id = ? AND is_valid = 1
    `;

    try {
      const session = await Database.get(sql, [sessionId]);
      if (!session) return null;

      // Check if session is expired (24 hours)
      const lastActivity = new Date(session.last_activity);
      const now = new Date();
      const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);

      if (hoursSinceActivity > 24) {
        await sessionManagement.invalidateSession(sessionId);
        return null;
      }

      return {
        ...session,
        data: JSON.parse(session.data || '{}')
      };
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  },

  // Update session activity
  updateSessionActivity: async (sessionId) => {
    const sql = `
      UPDATE user_sessions 
      SET last_activity = datetime('now') 
      WHERE session_id = ? AND is_valid = 1
    `;

    try {
      await Database.run(sql, [sessionId]);
    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  },

  // Invalidate session
  invalidateSession: async (sessionId) => {
    const sql = `
      UPDATE user_sessions 
      SET is_valid = 0, invalidated_at = datetime('now') 
      WHERE session_id = ?
    `;

    try {
      await Database.run(sql, [sessionId]);
      return true;
    } catch (error) {
      throw new Error(`Failed to invalidate session: ${error.message}`);
    }
  },

  // Invalidate all user sessions
  invalidateAllUserSessions: async (userId, exceptSessionId = null) => {
    let sql = `
      UPDATE user_sessions 
      SET is_valid = 0, invalidated_at = datetime('now') 
      WHERE user_id = ? AND is_valid = 1
    `;
    
    const params = [userId];
    
    if (exceptSessionId) {
      sql += ' AND session_id != ?';
      params.push(exceptSessionId);
    }

    try {
      const result = await Database.run(sql, params);
      return result.changes;
    } catch (error) {
      throw new Error(`Failed to invalidate user sessions: ${error.message}`);
    }
  },

  // Get active sessions for user
  getUserActiveSessions: async (userId) => {
    const sql = `
      SELECT session_id, device_fingerprint, ip_address, user_agent, 
             created_at, last_activity
      FROM user_sessions 
      WHERE user_id = ? AND is_valid = 1
      ORDER BY last_activity DESC
    `;

    try {
      const sessions = await Database.query(sql, [userId]);
      return sessions;
    } catch (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
  },

  // Check for concurrent session limit
  checkConcurrentSessions: async (userId, maxSessions = 5) => {
    const sql = `
      SELECT COUNT(*) as count 
      FROM user_sessions 
      WHERE user_id = ? AND is_valid = 1
    `;

    try {
      const result = await Database.get(sql, [userId]);
      return result.count < maxSessions;
    } catch (error) {
      console.error('Failed to check concurrent sessions:', error);
      return true; // Allow on error
    }
  },

  // Detect session hijacking
  detectSessionHijacking: async (sessionId, req) => {
    const session = await sessionManagement.getSession(sessionId);
    if (!session) return { hijacked: false };

    const currentFingerprint = securityUtils.generateDeviceFingerprint(req);
    const sessionFingerprint = session.device_fingerprint;
    const currentIP = req.ip;
    const sessionIP = session.ip_address;

    const factors = [];

    // Check device fingerprint change
    if (currentFingerprint !== sessionFingerprint) {
      factors.push('device_changed');
    }

    // Check significant IP change
    if (currentIP !== sessionIP) {
      // In production, you might want to check IP geolocation
      factors.push('ip_changed');
    }

    // Check user agent change
    if (req.get('User-Agent') !== session.user_agent) {
      factors.push('user_agent_changed');
    }

    const hijacked = factors.length >= 2; // Multiple factors indicate possible hijacking

    if (hijacked) {
      await securityUtils.logSecurityEvent({
        type: 'possible_session_hijacking',
        severity: 'critical',
        ip: currentIP,
        userAgent: req.get('User-Agent'),
        userId: session.user_id,
        details: {
          sessionId,
          factors,
          originalIP: sessionIP,
          currentIP
        }
      });
    }

    return { hijacked, factors };
  },

  // Initialize session tables
  initializeTables: async () => {
    try {
      await Database.run(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id VARCHAR(64) NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          device_fingerprint VARCHAR(64),
          ip_address VARCHAR(45),
          user_agent TEXT,
          data TEXT,
          is_valid BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          invalidated_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      await Database.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_session ON user_sessions(session_id)');
      await Database.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)');
      await Database.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_valid ON user_sessions(is_valid)');
      await Database.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_activity ON user_sessions(last_activity)');

      console.log('Session tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize session tables:', error);
    }
  },

  // Clean up expired sessions
  cleanupExpiredSessions: async () => {
    try {
      const result = await Database.run(`
        UPDATE user_sessions 
        SET is_valid = 0 
        WHERE is_valid = 1 
          AND last_activity < datetime('now', '-24 hours')
      `);
      
      console.log(`Cleaned up ${result.changes} expired sessions`);
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }
};

// Middleware to validate session
export const validateSession = async (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  
  if (!sessionId) {
    return next(); // No session provided
  }

  // Check session validity
  const session = await sessionManagement.getSession(sessionId);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid or expired session'
    });
  }

  // Check for session hijacking
  const hijackCheck = await sessionManagement.detectSessionHijacking(sessionId, req);
  if (hijackCheck.hijacked) {
    await sessionManagement.invalidateSession(sessionId);
    return res.status(401).json({
      error: 'Session security violation detected'
    });
  }

  // Update session activity
  await sessionManagement.updateSessionActivity(sessionId);

  // Add session to request
  req.session = session;
  next();
};

// Start cleanup interval
setInterval(sessionManagement.cleanupExpiredSessions, 60 * 60 * 1000); // Hourly cleanup