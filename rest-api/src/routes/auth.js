import express from 'express';
import User from '../models/User.js';
import { 
  generateTokens, 
  storeRefreshToken, 
  verifyRefreshToken, 
  removeRefreshToken,
  authenticate 
} from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler, ConflictError, UnauthorizedError, ValidationError } from '../middleware/errorHandler.js';
import { 
  authLimiter, 
  registerLimiter, 
  passwordResetLimiter,
  checkAccountLockout,
  accountLockout,
  securityHeaders
} from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply security headers to all auth routes
router.use(securityHeaders);

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', 
  registerLimiter,
  validate(schemas.registerUser),
  asyncHandler(async (req, res) => {
    const { username, email, password, first_name, last_name, bio } = req.body;

    // Check if user already exists
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      throw new ConflictError('User with this email already exists');
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      throw new ConflictError('Username is already taken');
    }

    // Create new user
    const newUser = await User.create({
      username,
      email,
      password,
      first_name,
      last_name,
      bio
    });

    // Generate tokens
    const tokens = generateTokens(newUser);
    
    // Store refresh token
    await storeRefreshToken(newUser.id, tokens.refreshToken);

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser.toSafeObject(),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  })
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login',
  authLimiter,
  checkAccountLockout,
  validate(schemas.loginUser),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      // Track failed attempt
      await accountLockout.trackFailedAttempt(email);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      await accountLockout.trackFailedAttempt(email);
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      // Track failed attempt
      await accountLockout.trackFailedAttempt(email);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Clear failed attempts on successful login
    await accountLockout.clearFailedAttempts(email);

    // Generate tokens
    const tokens = generateTokens(user);
    
    // Store refresh token
    await storeRefreshToken(user.id, tokens.refreshToken);

    res.json({
      message: 'Login successful',
      user: user.toSafeObject(),
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  })
);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const userData = await verifyRefreshToken(refreshToken, req);
    if (!userData) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Get fresh user data
    const user = await User.findById(userData.id);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate new tokens
    const tokens = generateTokens(user);
    
    // Remove old refresh token and store new one
    await removeRefreshToken(refreshToken);
    await storeRefreshToken(user.id, tokens.refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn
      }
    });
  })
);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await removeRefreshToken(refreshToken);
    }

    res.json({
      message: 'Logout successful'
    });
  })
);

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password',
  passwordResetLimiter,
  authenticate,
  validate(schemas.changePassword),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Update password
    await user.updatePassword(newPassword);

    res.json({
      message: 'Password changed successfully'
    });
  })
);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.user.toSafeObject()
    });
  })
);

// @route   PUT /api/auth/me
// @desc    Update current user profile
// @access  Private
router.put('/me',
  authenticate,
  validate(schemas.updateUser),
  asyncHandler(async (req, res) => {
    const updateData = req.body;
    
    // Check if email/username is being changed and already exists
    if (updateData.email && updateData.email !== req.user.email) {
      const existingUser = await User.findByEmail(updateData.email);
      if (existingUser) {
        throw new ConflictError('Email is already in use');
      }
    }
    
    if (updateData.username && updateData.username !== req.user.username) {
      const existingUser = await User.findByUsername(updateData.username);
      if (existingUser) {
        throw new ConflictError('Username is already taken');
      }
    }

    // Update user
    const updatedUser = await req.user.update(updateData);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser.toSafeObject()
    });
  })
);

// @route   DELETE /api/auth/me
// @desc    Delete current user account
// @access  Private
router.delete('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    await req.user.delete();

    res.json({
      message: 'Account deleted successfully'
    });
  })
);

export default router;