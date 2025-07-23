/**
 * Auth Service Unit Tests
 * Tests authentication service methods, token generation, password hashing
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AuthService = require('../../../examples/05-swarm-apps/rest-api-advanced/src/services/auth.service');
const User = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const hashedPassword = 'hashedPassword123';
      const savedUser = { 
        id: 1, 
        ...userData, 
        password: hashedPassword,
        save: jest.fn().mockResolvedValue(true)
      };

      bcrypt.hash.mockResolvedValue(hashedPassword);
      User.findOne.mockResolvedValue(null); // User doesn't exist
      User.create.mockResolvedValue(savedUser);

      const result = await AuthService.registerUser(userData);

      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(User.create).toHaveBeenCalledWith({
        ...userData,
        password: hashedPassword
      });
      expect(result).toEqual(savedUser);
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User'
      };

      User.findOne.mockResolvedValue({ id: 1, email: userData.email });

      await expect(AuthService.registerUser(userData))
        .rejects
        .toThrow('User already exists with this email');

      expect(User.create).not.toHaveBeenCalled();
    });

    it('should handle password hashing errors', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockRejectedValue(new Error('Hashing failed'));

      await expect(AuthService.registerUser(userData))
        .rejects
        .toThrow('Hashing failed');
    });
  });

  describe('loginUser', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const user = {
        id: 1,
        email: loginData.email,
        password: 'hashedPassword123',
        name: 'Test User'
      };

      const token = 'jwt.token.here';

      User.findOne.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue(token);

      const result = await AuthService.loginUser(loginData);

      expect(User.findOne).toHaveBeenCalledWith({ email: loginData.email });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, user.password);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );
      expect(result).toEqual({ user: { id: user.id, email: user.email, name: user.name }, token });
    });

    it('should throw error for invalid email', async () => {
      const loginData = {
        email: 'invalid@example.com',
        password: 'password123'
      };

      User.findOne.mockResolvedValue(null);

      await expect(AuthService.loginUser(loginData))
        .rejects
        .toThrow('Invalid credentials');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'invalidpassword'
      };

      const user = {
        id: 1,
        email: loginData.email,
        password: 'hashedPassword123'
      };

      User.findOne.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(false);

      await expect(AuthService.loginUser(loginData))
        .rejects
        .toThrow('Invalid credentials');

      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 1, email: 'test@example.com' };
      const user = { id: 1, email: 'test@example.com', name: 'Test User' };

      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(user);

      const result = await AuthService.verifyToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith(decoded.userId);
      expect(result).toEqual(user);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid.jwt.token';

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(AuthService.verifyToken(token))
        .rejects
        .toThrow('Invalid token');

      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 999, email: 'test@example.com' };

      jwt.verify.mockReturnValue(decoded);
      User.findById.mockResolvedValue(null);

      await expect(AuthService.verifyToken(token))
        .rejects
        .toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 1;
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      const user = {
        id: userId,
        password: 'hashedOldPassword',
        save: jest.fn().mockResolvedValue(true)
      };

      const newHashedPassword = 'hashedNewPassword123';

      User.findById.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue(newHashedPassword);

      const result = await AuthService.changePassword(userId, passwordData);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(passwordData.currentPassword, user.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordData.newPassword, 12);
      expect(user.password).toBe(newHashedPassword);
      expect(user.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error for invalid current password', async () => {
      const userId = 1;
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const user = {
        id: userId,
        password: 'hashedOldPassword'
      };

      User.findById.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(false);

      await expect(AuthService.changePassword(userId, passwordData))
        .rejects
        .toThraw('Invalid current password');

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const user = {
        id: 1,
        email,
        resetPasswordToken: null,
        resetPasswordExpire: null,
        save: jest.fn().mockResolvedValue(true)
      };

      const resetToken = 'reset-token-123';
      const hashedResetToken = 'hashed-reset-token-123';

      User.findOne.mockResolvedValue(user);
      
      // Mock crypto for reset token generation
      const crypto = require('crypto');
      crypto.randomBytes = jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue(resetToken)
      });
      crypto.createHash = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(hashedResetToken)
      });

      const result = await AuthService.generatePasswordResetToken(email);

      expect(User.findOne).toHaveBeenCalledWith({ email });
      expect(user.resetPasswordToken).toBe(hashedResetToken);
      expect(user.resetPasswordExpire).toBeInstanceOf(Date);
      expect(user.save).toHaveBeenCalled();
      expect(result).toBe(resetToken);
    });

    it('should throw error if user not found', async () => {
      const email = 'notfound@example.com';
      
      User.findOne.mockResolvedValue(null);

      await expect(AuthService.generatePasswordResetToken(email))
        .rejects
        .toThrow('User not found with this email');
    });
  });
});