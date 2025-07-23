const userService = require('../../../examples/05-swarm-apps/rest-api-advanced/src/services/user.service');
const User = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const ApiError = require('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/ApiError');
const { faker } = require('@faker-js/faker');

// Mock dependencies
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(userId);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findById.mockResolvedValue(null);

      await expect(userService.getUserById(userId))
        .rejects
        .toThrow(new ApiError('User not found', 404));
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = {
        name: 'Updated Name',
        phone: '+1234567890',
      };
      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        name: 'Test User',
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      const result = await userService.updateUserProfile(userId, updateData);

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(mockUser.name).toBe(updateData.name);
      expect(mockUser.phone).toBe(updateData.phone);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should not update protected fields', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const updateData = {
        email: 'newemail@example.com',
        password: 'newpassword',
        role: 'admin',
      };
      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      await userService.updateUserProfile(userId, updateData);

      expect(mockUser.email).toBe('test@example.com');
      expect(mockUser.role).toBe('user');
      expect(mockUser.password).toBeUndefined();
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        isActive: true,
        deactivatedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      await userService.deactivateUser(userId);

      expect(mockUser.isActive).toBe(false);
      expect(mockUser.deactivatedAt).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findById.mockResolvedValue(null);

      await expect(userService.deactivateUser(userId))
        .rejects
        .toThrow(new ApiError('User not found', 404));
    });
  });

  describe('getUsersWithPagination', () => {
    it('should return paginated users', async () => {
      const options = { page: 1, limit: 10 };
      const mockUsers = [
        { _id: '1', name: 'User 1', email: 'user1@example.com' },
        { _id: '2', name: 'User 2', email: 'user2@example.com' },
      ];

      User.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      });
      User.countDocuments.mockResolvedValue(25);

      const result = await userService.getUsersWithPagination(options);

      expect(result.users).toEqual(mockUsers);
      expect(result.totalUsers).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(1);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should apply search filter', async () => {
      const options = { page: 1, limit: 10, search: 'john' };
      const mockUsers = [
        { _id: '1', name: 'John Doe', email: 'john@example.com' },
      ];

      User.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockUsers),
          }),
        }),
      });
      User.countDocuments.mockResolvedValue(1);

      await userService.getUsersWithPagination(options);

      expect(User.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: 'john', $options: 'i' } },
          { email: { $regex: 'john', $options: 'i' } },
        ],
      });
    });
  });

  describe('changeUserPassword', () => {
    it('should change password successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const oldPassword = 'oldpassword';
      const newPassword = 'newpassword123';
      const mockUser = {
        _id: userId,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockResolvedValue(mockUser);

      await userService.changeUserPassword(userId, oldPassword, newPassword);

      expect(mockUser.comparePassword).toHaveBeenCalledWith(oldPassword);
      expect(mockUser.password).toBe(newPassword);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should throw error for incorrect old password', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const oldPassword = 'wrongpassword';
      const newPassword = 'newpassword123';
      const mockUser = {
        _id: userId,
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      User.findById.mockResolvedValue(mockUser);

      await expect(userService.changeUserPassword(userId, oldPassword, newPassword))
        .rejects
        .toThrow(new ApiError('Current password is incorrect', 400));
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = [
        { _id: null, totalUsers: 100, activeUsers: 85, inactiveUsers: 15 },
      ];

      User.aggregate.mockResolvedValue(mockStats);

      const result = await userService.getUserStats();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 85,
        inactiveUsers: 15,
      });
    });

    it('should return default stats when no data', async () => {
      User.aggregate.mockResolvedValue([]);

      const result = await userService.getUserStats();

      expect(result).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
      });
    });
  });
});