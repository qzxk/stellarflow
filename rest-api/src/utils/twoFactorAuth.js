import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { Database } from '../config/database.js';

// Two-Factor Authentication utilities
export const twoFactorAuth = {
  // Generate 2FA secret for user
  generateSecret: (userEmail, appName = 'StellarFlow API') => {
    const secret = speakeasy.generateSecret({
      name: `${appName} (${userEmail})`,
      length: 32
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url
    };
  },

  // Generate QR code for secret
  generateQRCode: async (otpauthUrl) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  },

  // Verify TOTP token
  verifyToken: (token, secret) => {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps for clock drift
      });
    } catch (error) {
      console.error('2FA verification error:', error);
      return false;
    }
  },

  // Generate backup codes
  generateBackupCodes: (count = 8) => {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  },

  // Save 2FA secret for user
  saveUserSecret: async (userId, secret, backupCodes) => {
    try {
      // Hash backup codes before storing
      const hashedCodes = backupCodes.map(code => 
        require('crypto').createHash('sha256').update(code).digest('hex')
      );

      const sql = `
        INSERT OR REPLACE INTO two_factor_auth (
          user_id, secret, backup_codes, is_enabled, created_at
        ) VALUES (?, ?, ?, 0, datetime('now'))
      `;

      await Database.run(sql, [
        userId,
        secret,
        JSON.stringify(hashedCodes)
      ]);

      return true;
    } catch (error) {
      throw new Error(`Failed to save 2FA secret: ${error.message}`);
    }
  },

  // Enable 2FA for user
  enableTwoFactor: async (userId) => {
    try {
      const sql = `
        UPDATE two_factor_auth 
        SET is_enabled = 1, enabled_at = datetime('now')
        WHERE user_id = ?
      `;

      await Database.run(sql, [userId]);
      return true;
    } catch (error) {
      throw new Error(`Failed to enable 2FA: ${error.message}`);
    }
  },

  // Disable 2FA for user
  disableTwoFactor: async (userId) => {
    try {
      const sql = `
        UPDATE two_factor_auth 
        SET is_enabled = 0, disabled_at = datetime('now')
        WHERE user_id = ?
      `;

      await Database.run(sql, [userId]);
      return true;
    } catch (error) {
      throw new Error(`Failed to disable 2FA: ${error.message}`);
    }
  },

  // Get user's 2FA settings
  getUserTwoFactorSettings: async (userId) => {
    try {
      const sql = `
        SELECT secret, is_enabled, backup_codes, created_at, enabled_at
        FROM two_factor_auth
        WHERE user_id = ?
      `;

      const result = await Database.get(sql, [userId]);
      return result;
    } catch (error) {
      throw new Error(`Failed to get 2FA settings: ${error.message}`);
    }
  },

  // Verify backup code
  verifyBackupCode: async (userId, code) => {
    try {
      const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
      if (!settings) return false;

      const hashedCode = require('crypto').createHash('sha256').update(code).digest('hex');
      const backupCodes = JSON.parse(settings.backup_codes);
      
      const codeIndex = backupCodes.indexOf(hashedCode);
      if (codeIndex === -1) return false;

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      
      const sql = `
        UPDATE two_factor_auth 
        SET backup_codes = ?
        WHERE user_id = ?
      `;

      await Database.run(sql, [JSON.stringify(backupCodes), userId]);
      
      return true;
    } catch (error) {
      console.error('Backup code verification error:', error);
      return false;
    }
  },

  // Check if user has 2FA enabled
  isEnabled: async (userId) => {
    try {
      const sql = 'SELECT is_enabled FROM two_factor_auth WHERE user_id = ?';
      const result = await Database.get(sql, [userId]);
      return result?.is_enabled === 1;
    } catch (error) {
      console.error('2FA check error:', error);
      return false;
    }
  },

  // Initialize 2FA tables
  initializeTables: async () => {
    try {
      await Database.run(`
        CREATE TABLE IF NOT EXISTS two_factor_auth (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          secret VARCHAR(64) NOT NULL,
          backup_codes TEXT,
          is_enabled BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          enabled_at DATETIME,
          disabled_at DATETIME,
          last_used_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await Database.run(`
        CREATE TABLE IF NOT EXISTS two_factor_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      await Database.run('CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user ON two_factor_auth(user_id)');
      await Database.run('CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user ON two_factor_attempts(user_id)');
      await Database.run('CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_attempted ON two_factor_attempts(attempted_at)');

      console.log('2FA tables initialized successfully');
    } catch (error) {
      console.error('Failed to initialize 2FA tables:', error);
    }
  },

  // Log 2FA attempt
  logAttempt: async (userId, success, req) => {
    try {
      const sql = `
        INSERT INTO two_factor_attempts (user_id, success, ip_address, user_agent)
        VALUES (?, ?, ?, ?)
      `;

      await Database.run(sql, [
        userId,
        success ? 1 : 0,
        req.ip,
        req.get('User-Agent')
      ]);
    } catch (error) {
      console.error('Failed to log 2FA attempt:', error);
    }
  },

  // Check for suspicious 2FA activity
  checkSuspiciousActivity: async (userId) => {
    try {
      // Check failed attempts in last hour
      const sql = `
        SELECT COUNT(*) as failed_count
        FROM two_factor_attempts
        WHERE user_id = ? 
          AND success = 0 
          AND attempted_at > datetime('now', '-1 hour')
      `;

      const result = await Database.get(sql, [userId]);
      const failedCount = result.failed_count;

      // More than 5 failed attempts in an hour is suspicious
      return {
        suspicious: failedCount > 5,
        failedAttempts: failedCount
      };
    } catch (error) {
      console.error('Failed to check 2FA suspicious activity:', error);
      return { suspicious: false, failedAttempts: 0 };
    }
  }
};

// Export speakeasy for direct use if needed
export { speakeasy };