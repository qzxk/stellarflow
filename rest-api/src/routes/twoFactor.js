import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import { twoFactorAuth } from '../utils/twoFactorAuth.js';
import { securityUtils } from '../utils/security.js';

const router = express.Router();

// @route   GET /api/2fa/setup
// @desc    Get 2FA setup information
// @access  Private
router.get('/setup',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Check if 2FA is already enabled
    const isEnabled = await twoFactorAuth.isEnabled(userId);
    if (isEnabled) {
      return res.status(400).json({
        error: '2FA is already enabled for this account'
      });
    }

    // Generate secret and backup codes
    const { secret, otpauth_url } = twoFactorAuth.generateSecret(req.user.email);
    const backupCodes = twoFactorAuth.generateBackupCodes();
    const qrCode = await twoFactorAuth.generateQRCode(otpauth_url);

    // Save secret (but don't enable yet)
    await twoFactorAuth.saveUserSecret(userId, secret, backupCodes);

    res.json({
      secret,
      qrCode,
      backupCodes,
      instructions: {
        step1: 'Install an authenticator app (Google Authenticator, Authy, etc.)',
        step2: 'Scan the QR code or enter the secret manually',
        step3: 'Enter the 6-digit code from your app to verify',
        step4: 'Save the backup codes in a secure location'
      }
    });
  })
);

// @route   POST /api/2fa/enable
// @desc    Enable 2FA after verification
// @access  Private
router.post('/enable',
  authenticate,
  validate(schemas.enable2FA),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { token } = req.body;

    // Check if 2FA is already enabled
    const isEnabled = await twoFactorAuth.isEnabled(userId);
    if (isEnabled) {
      return res.status(400).json({
        error: '2FA is already enabled for this account'
      });
    }

    // Get user's secret
    const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
    if (!settings) {
      return res.status(400).json({
        error: '2FA setup not initiated. Please start with /api/2fa/setup'
      });
    }

    // Verify the token
    const isValid = twoFactorAuth.verifyToken(token, settings.secret);
    
    if (!isValid) {
      await twoFactorAuth.logAttempt(userId, false, req);
      
      return res.status(400).json({
        error: 'Invalid authentication code'
      });
    }

    // Enable 2FA
    await twoFactorAuth.enableTwoFactor(userId);
    await twoFactorAuth.logAttempt(userId, true, req);

    // Log security event
    await securityUtils.logSecurityEvent({
      type: '2fa_enabled',
      severity: 'info',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId,
      details: { method: 'totp' }
    });

    res.json({
      message: '2FA has been successfully enabled',
      backupCodesReminder: 'Make sure you have saved your backup codes'
    });
  })
);

// @route   POST /api/2fa/verify
// @desc    Verify 2FA code during login
// @access  Public (but requires partial auth state)
router.post('/verify',
  validate(schemas.verify2FA),
  asyncHandler(async (req, res) => {
    const { userId, token, isBackupCode } = req.body;

    // Get user's 2FA settings
    const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
    if (!settings || !settings.is_enabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account'
      });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      isValid = await twoFactorAuth.verifyBackupCode(userId, token);
      
      if (isValid) {
        await securityUtils.logSecurityEvent({
          type: '2fa_backup_code_used',
          severity: 'warning',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId,
          details: { remaining_codes: JSON.parse(settings.backup_codes).length - 1 }
        });
      }
    } else {
      // Verify TOTP token
      isValid = twoFactorAuth.verifyToken(token, settings.secret);
    }

    await twoFactorAuth.logAttempt(userId, isValid, req);

    if (!isValid) {
      // Check for suspicious activity
      const suspicious = await twoFactorAuth.checkSuspiciousActivity(userId);
      
      if (suspicious.suspicious) {
        await securityUtils.logSecurityEvent({
          type: '2fa_suspicious_activity',
          severity: 'warning',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId,
          details: { failed_attempts: suspicious.failedAttempts }
        });
      }

      return res.status(400).json({
        error: 'Invalid authentication code'
      });
    }

    // Return success (actual token generation would be in auth route)
    res.json({
      verified: true,
      message: '2FA verification successful'
    });
  })
);

// @route   POST /api/2fa/disable
// @desc    Disable 2FA
// @access  Private
router.post('/disable',
  authenticate,
  validate(schemas.disable2FA),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { password, token } = req.body;

    // Verify password first
    const user = await req.user.constructor.findById(userId);
    const isPasswordValid = await user.verifyPassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password'
      });
    }

    // Get 2FA settings
    const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
    if (!settings || !settings.is_enabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account'
      });
    }

    // Verify 2FA token
    const isValid = twoFactorAuth.verifyToken(token, settings.secret);
    
    if (!isValid) {
      await twoFactorAuth.logAttempt(userId, false, req);
      
      return res.status(400).json({
        error: 'Invalid authentication code'
      });
    }

    // Disable 2FA
    await twoFactorAuth.disableTwoFactor(userId);
    await twoFactorAuth.logAttempt(userId, true, req);

    // Log security event
    await securityUtils.logSecurityEvent({
      type: '2fa_disabled',
      severity: 'warning',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId
    });

    res.json({
      message: '2FA has been disabled'
    });
  })
);

// @route   GET /api/2fa/status
// @desc    Get 2FA status for user
// @access  Private
router.get('/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
    
    if (!settings) {
      return res.json({
        enabled: false,
        configured: false
      });
    }

    const backupCodesCount = settings.backup_codes ? 
      JSON.parse(settings.backup_codes).length : 0;

    res.json({
      enabled: settings.is_enabled === 1,
      configured: true,
      enabledAt: settings.enabled_at,
      backupCodesRemaining: backupCodesCount
    });
  })
);

// @route   POST /api/2fa/backup-codes/regenerate
// @desc    Regenerate backup codes
// @access  Private
router.post('/backup-codes/regenerate',
  authenticate,
  validate(schemas.regenerateBackupCodes),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { password, token } = req.body;

    // Verify password
    const user = await req.user.constructor.findById(userId);
    const isPasswordValid = await user.verifyPassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password'
      });
    }

    // Get 2FA settings
    const settings = await twoFactorAuth.getUserTwoFactorSettings(userId);
    if (!settings || !settings.is_enabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account'
      });
    }

    // Verify 2FA token
    const isValid = twoFactorAuth.verifyToken(token, settings.secret);
    
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid authentication code'
      });
    }

    // Generate new backup codes
    const newBackupCodes = twoFactorAuth.generateBackupCodes();
    
    // Save new codes
    await twoFactorAuth.saveUserSecret(userId, settings.secret, newBackupCodes);

    // Log security event
    await securityUtils.logSecurityEvent({
      type: '2fa_backup_codes_regenerated',
      severity: 'info',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId
    });

    res.json({
      message: 'Backup codes regenerated successfully',
      backupCodes: newBackupCodes,
      warning: 'Your old backup codes are now invalid. Save these new codes securely.'
    });
  })
);

export default router;