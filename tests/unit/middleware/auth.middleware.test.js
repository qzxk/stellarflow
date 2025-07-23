/**
 * Authentication Middleware Unit Tests
 * Tests JWT verification, user authentication, role-based access
 */

const authMiddleware = require('../../../examples/05-swarm-apps/rest-api-advanced/src/middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 1, email: 'test@example.com' };
      const user = { id: 1, email: 'test@example.com', name: 'Test User', role: 'user' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(user);

      await authMiddleware.authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(decoded.userId);
      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no token provided', async () => {
      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is malformed', async () => {
      req.headers.authorization = 'InvalidTokenFormat';

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token is required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      const token = 'invalid.jwt.token';
      req.headers.authorization = `Bearer ${token}`;
      
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid access token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is expired', async () => {
      const token = 'expired.jwt.token';
      req.headers.authorization = `Bearer ${token}`;
      
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token has expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 999, email: 'test@example.com' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(null);

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should authorize user with correct role', () => {
      const roles = ['admin', 'manager'];
      req.user = { id: 1, role: 'admin' };

      const authorizeMiddleware = authMiddleware.authorize(roles);
      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for user with insufficient role', () => {
      const roles = ['admin', 'manager'];
      req.user = { id: 1, role: 'user' };

      const authorizeMiddleware = authMiddleware.authorize(roles);
      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access if user not authenticated', () => {
      const roles = ['admin'];

      const authorizeMiddleware = authMiddleware.authorize(roles);
      authorizeMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle single role string', () => {
      req.user = { id: 1, role: 'admin' };

      const authorizeMiddleware = authMiddleware.authorize('admin');
      authorizeMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user if token is provided and valid', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 1, email: 'test@example.com' };
      const user = { id: 1, email: 'test@example.com', name: 'Test User' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(user);

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user if no token provided', async () => {
      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user if token is invalid', async () => {
      const token = 'invalid.jwt.token';
      req.headers.authorization = `Bearer ${token}`;
      
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkAccountStatus', () => {
    it('should allow access for active user', () => {
      req.user = { id: 1, status: 'active' };

      authMiddleware.checkAccountStatus(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for suspended user', () => {
      req.user = { id: 1, status: 'suspended' };

      authMiddleware.checkAccountStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Account is suspended'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access for deactivated user', () => {
      req.user = { id: 1, status: 'deactivated' };

      authMiddleware.checkAccountStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Account is deactivated'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});