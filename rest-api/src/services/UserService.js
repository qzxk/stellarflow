import User from '../models/User.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler.js';

class UserService {
  // Create new user with validation
  static async createUser(userData) {
    const { username, email, password, first_name, last_name, bio } = userData;

    // Check if user already exists
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      throw new ConflictError('User with this email already exists');
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      throw new ConflictError('Username is already taken');
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      first_name,
      last_name,
      bio
    });

    return user;
  }

  // Authenticate user
  static async authenticateUser(email, password) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return user;
  }

  // Get user by ID with validation
  static async getUserById(id, requestingUserId = null, isAdmin = false) {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Return different data based on permissions
    if (requestingUserId === user.id || isAdmin) {
      return user.toSafeObject();
    } else {
      return {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at
      };
    }
  }

  // Update user with conflict checking
  static async updateUser(userId, updateData, requestingUserId = null, isAdmin = false) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check permissions
    if (requestingUserId !== user.id && !isAdmin) {
      throw new UnauthorizedError('You can only update your own profile');
    }

    // Check for conflicts if email/username is being changed
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findByEmail(updateData.email);
      if (existingUser) {
        throw new ConflictError('Email is already in use');
      }
    }

    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await User.findByUsername(updateData.username);
      if (existingUser) {
        throw new ConflictError('Username is already taken');
      }
    }

    // Update user
    const updatedUser = await user.update(updateData);
    return updatedUser;
  }

  // Get users with pagination and search
  static async getUsers(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      sort = 'created_at',
      order = 'desc'
    } = options;

    const offset = (page - 1) * limit;

    let users;
    let totalUsers;

    if (search) {
      users = await User.search(search, limit, offset);
      // For search, we don't have a separate count method, so estimate
      totalUsers = users.length < limit ? offset + users.length : offset + limit + 1;
    } else {
      users = await User.findAll(limit, offset);
      totalUsers = await User.getTotalCount();
    }

    const totalPages = Math.ceil(totalUsers / limit);

    return {
      users: users.map(user => user.toSafeObject()),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalUsers,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Search users
  static async searchUsers(query, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const users = await User.search(query, limit, offset);

    return {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        bio: user.bio
      })),
      query,
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    };
  }

  // Delete user (admin only)
  static async deleteUser(userId, requestingUserId, isAdmin) {
    if (!isAdmin) {
      throw new UnauthorizedError('Admin access required');
    }

    // Prevent admin from deleting themselves
    if (parseInt(userId) === requestingUserId) {
      throw new ConflictError('Cannot delete your own account');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.delete();
    return { message: 'User deleted successfully' };
  }

  // Activate/Deactivate user (admin only)
  static async toggleUserStatus(userId, isActive, requestingUserId, isAdmin) {
    if (!isAdmin) {
      throw new UnauthorizedError('Admin access required');
    }

    // Prevent admin from deactivating themselves
    if (!isActive && parseInt(userId) === requestingUserId) {
      throw new ConflictError('Cannot deactivate your own account');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await user.update({ is_active: isActive });
    return {
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: updatedUser.toSafeObject()
    };
  }

  // Change password
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Update password
    await user.updatePassword(newPassword);
    return { message: 'Password changed successfully' };
  }

  // Get user's posts
  static async getUserPosts(userId, page = 1, limit = 10) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const offset = (page - 1) * limit;
    const posts = await user.getPosts(limit, offset);

    return {
      posts,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url
      },
      pagination: {
        currentPage: page,
        itemsPerPage: limit
      }
    };
  }

  // Soft delete current user account
  static async deleteCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.delete();
    return { message: 'Account deleted successfully' };
  }
}

export default UserService;