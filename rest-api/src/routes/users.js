import express from 'express';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler.js';
import UserService from '../services/UserService.js';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/',
  authenticate,
  requireAdmin,
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query;
    const result = await UserService.getUsers({ page, limit });
    res.json(result);
  })
);

// @route   GET /api/users/search
// @desc    Search users
// @access  Private
router.get('/search',
  authenticate,
  validate(schemas.searchQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { q: query, page, limit } = req.query;
    const result = await UserService.searchUsers(query, page, limit);
    res.json(result);
  })
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Return public profile info
    const publicProfile = {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at
    };

    // Add email if viewing own profile or admin
    if (req.user.id === user.id || req.user.role === 'admin') {
      publicProfile.email = user.email;
      publicProfile.role = user.role;
      publicProfile.is_active = user.is_active;
      publicProfile.updated_at = user.updated_at;
    }

    res.json({
      user: publicProfile
    });
  })
);

// @route   GET /api/users/:id/posts
// @desc    Get user's posts
// @access  Public
router.get('/:id/posts',
  validate(schemas.idParam, 'params'),
  validate(schemas.paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const posts = await user.getPosts(limit, offset);
    
    res.json({
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
    });
  })
);

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put('/:id',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  validate(schemas.updateUser),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if email/username is being changed and already exists
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

    const updatedUser = await user.update(updateData);

    res.json({
      message: 'User updated successfully',
      user: updatedUser.toSafeObject()
    });
  })
);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.delete();

    res.json({
      message: 'User deleted successfully'
    });
  })
);

// @route   POST /api/users/:id/activate
// @desc    Activate user account (admin only)
// @access  Private/Admin
router.post('/:id/activate',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await user.update({ is_active: true });

    res.json({
      message: 'User activated successfully',
      user: updatedUser.toSafeObject()
    });
  })
);

// @route   POST /api/users/:id/deactivate
// @desc    Deactivate user account (admin only)
// @access  Private/Admin
router.post('/:id/deactivate',
  authenticate,
  requireAdmin,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (parseInt(userId) === req.user.id) {
      throw new ForbiddenError('Cannot deactivate your own account');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await user.update({ is_active: false });

    res.json({
      message: 'User deactivated successfully',
      user: updatedUser.toSafeObject()
    });
  })
);

export default router;