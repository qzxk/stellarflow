import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Database } from '../config/database.js';
import { UserService } from '../services/UserService.js';

class AuthController {
  async register(req, res, next) {
    try {
      const { username, email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await Database.get(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
      );

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email or username already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || 10));

      // Create user
      const result = await Database.run(
        `INSERT INTO users (username, email, password_hash, first_name, last_name) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, passwordHash, firstName || null, lastName || null]
      );

      // Get created user
      const user = await UserService.findById(result.lastID);
      delete user.password_hash;

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, tokenType: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
      );

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await Database.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_at, ip_address) VALUES (?, ?, ?, ?)',
        [refreshToken, user.id, expiresAt.toISOString(), req.ip]
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await Database.get(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        [email]
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Update login info
      await Database.run(
        'UPDATE users SET last_login = ?, login_count = login_count + 1 WHERE id = ?',
        [new Date().toISOString(), user.id]
      );

      delete user.password_hash;

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, tokenType: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
      );

      // Store refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await Database.run(
        'INSERT INTO refresh_tokens (token, user_id, expires_at, ip_address, device_info) VALUES (?, ?, ?, ?, ?)',
        [refreshToken, user.id, expiresAt.toISOString(), req.ip, req.get('User-Agent')]
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
      }

      // Verify refresh token
      let payload;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Check if token exists and is not revoked
      const storedToken = await Database.get(
        'SELECT * FROM refresh_tokens WHERE token = ? AND is_revoked = 0 AND expires_at > ?',
        [refreshToken, new Date().toISOString()]
      );

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token'
        });
      }

      // Get user
      const user = await UserService.findById(payload.userId);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      }

      delete user.password_hash;

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        success: true,
        data: {
          accessToken,
          user
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;

      if (refreshToken) {
        // Revoke specific refresh token
        await Database.run(
          'UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ? WHERE token = ?',
          [new Date().toISOString(), refreshToken]
        );
      } else if (userId) {
        // Revoke all user's refresh tokens
        await Database.run(
          'UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ? WHERE user_id = ? AND is_revoked = 0',
          [new Date().toISOString(), userId]
        );
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      // Get user
      const user = await Database.get(
        'SELECT password_hash FROM users WHERE id = ?',
        [userId]
      );

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || 10));

      // Update password
      await Database.run(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [newPasswordHash, new Date().toISOString(), userId]
      );

      // Revoke all refresh tokens
      await Database.run(
        'UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ? WHERE user_id = ? AND is_revoked = 0',
        [new Date().toISOString(), userId]
      );

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      // Find user
      const user = await Database.get(
        'SELECT id, email, first_name FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        // Don't reveal if email exists
        return res.json({
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        });
      }

      // Generate reset token (simplified version - in production, use a proper token service)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // In production, send email with reset link
      // For now, just return the token
      res.json({
        success: true,
        message: 'Password reset token generated',
        data: {
          resetToken,
          expiresIn: '1 hour'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      // Verify token
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type !== 'password-reset') {
          throw new Error('Invalid token type');
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || 10));

      // Update password
      await Database.run(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [passwordHash, new Date().toISOString(), payload.userId]
      );

      // Revoke all refresh tokens
      await Database.run(
        'UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ? WHERE user_id = ? AND is_revoked = 0',
        [new Date().toISOString(), payload.userId]
      );

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();