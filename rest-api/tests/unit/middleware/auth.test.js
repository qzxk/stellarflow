import jwt from 'jsonwebtoken';
import { authenticate, authorize, refreshToken, revokeToken } from '../../../src/middleware/auth.js';
import User from '../../../src/models/User.js';
import { Database } from '../../../src/config/database.js';
import { securityUtils } from '../../../src/utils/security.js';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/models/User.js');
jest.mock('../../../src/config/database.js');
jest.mock('../../../src/utils/security.js');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Default security utils behavior
    securityUtils.checkIPRestrictions.mockResolvedValue({ allowed: true });
    securityUtils.logSecurityEvent.mockResolvedValue();
    securityUtils.validateTokenStructure.mockReturnValue(true);
  });

  describe('authenticate', () => {
    it('should authenticate valid token', async () => {
      const mockUser = { id: 1, username: 'testuser', role: 'user' };
      const mockToken = 'valid-token';
      
      req.headers.authorization = `Bearer ${mockToken}`;
      jwt.verify.mockReturnValue({ id: 1 });
      User.findById.mockResolvedValue(mockUser);

      await authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(1);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request with no authorization header', async () => {
      await authenticate(req, res, next);

      expect(securityUtils.logSecurityEvent).toHaveBeenCalledWith({
        type: 'missing_auth_header',
        severity: 'info',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0'
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied. No token provided or invalid format.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request from blocked IP', async () => {
      req.headers.authorization = 'Bearer valid-token';
      securityUtils.checkIPRestrictions.mockResolvedValue({ 
        allowed: false, 
        reason: 'IP blocked' 
      });

      await authenticate(req, res, next);

      expect(securityUtils.logSecurityEvent).toHaveBeenCalledWith({
        type: 'blocked_ip_access',
        severity: 'warning',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { reason: 'IP blocked' }
      });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied from this IP address.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token structure', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      securityUtils.validateTokenStructure.mockReturnValue(false);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token format.'
      });
    });

    it('should reject expired token', async () => {
      req.headers.authorization = 'Bearer expired-token';
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token has expired. Please login again.'
      });
    });

    it('should reject token with invalid signature', async () => {
      req.headers.authorization = 'Bearer invalid-signature-token';
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token.'
      });
    });

    it('should reject if user not found', async () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ id: 999 });
      User.findById.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not found.'
      });
    });

    it('should reject inactive user', async () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ id: 1 });
      User.findById.mockResolvedValue({ id: 1, is_active: false });

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Account is deactivated.'
      });
    });

    it('should handle database errors gracefully', async () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ id: 1 });
      User.findById.mockRejectedValue(new Error('Database error'));

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error during authentication.'
      });
    });
  });

  describe('authorize', () => {
    it('should authorize user with correct role', () => {
      const middleware = authorize(['admin', 'user']);
      req.user = { role: 'admin' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user with incorrect role', () => {
      const middleware = authorize(['admin']);
      req.user = { role: 'user' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied. Insufficient permissions.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject if no user attached to request', () => {
      const middleware = authorize(['admin']);
      req.user = null;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle single role as string', () => {
      const middleware = authorize('admin');
      req.user = { role: 'admin' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid token', async () => {
      const mockRefreshToken = 'valid-refresh-token';
      const mockUser = { id: 1, username: 'testuser' };
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      req.body = { refreshToken: mockRefreshToken };
      
      Database.get.mockResolvedValue({
        userId: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      });
      User.findById.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValueOnce(newAccessToken).mockReturnValueOnce(newRefreshToken);
      Database.run.mockResolvedValue({});

      await refreshToken(req, res, next);

      expect(Database.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM refresh_tokens'),
        [mockRefreshToken]
      );
      expect(res.json).toHaveBeenCalledWith({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: mockUser
      });
    });

    it('should reject missing refresh token', async () => {
      req.body = {};

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Refresh token is required.'
      });
    });

    it('should reject invalid refresh token', async () => {
      req.body = { refreshToken: 'invalid-token' };
      Database.get.mockResolvedValue(null);

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid refresh token.'
      });
    });

    it('should reject expired refresh token', async () => {
      req.body = { refreshToken: 'expired-token' };
      Database.get.mockResolvedValue({
        userId: 1,
        expiresAt: new Date(Date.now() - 86400000).toISOString()
      });

      await refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Refresh token has expired.'
      });
    });
  });

  describe('revokeToken', () => {
    it('should revoke all user tokens', async () => {
      req.user = { id: 1 };
      Database.run.mockResolvedValue({});

      await revokeToken(req, res, next);

      expect(Database.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM refresh_tokens'),
        [1]
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'All tokens revoked successfully.'
      });
    });

    it('should handle database errors during revocation', async () => {
      req.user = { id: 1 };
      Database.run.mockRejectedValue(new Error('Database error'));

      await revokeToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to revoke tokens.'
      });
    });
  });
});