import express from 'express';
import ApiKey from '../models/ApiKey.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createRateLimit } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rate limiter for API key operations
const apiKeyLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 API key operations per 15 minutes
  message: 'Too many API key operations, please try again later.'
});

// @route   GET /api/api-keys
// @desc    Get all API keys for authenticated user
// @access  Private
router.get('/', 
  authenticate,
  asyncHandler(async (req, res) => {
    const keys = await ApiKey.findByUserId(req.user.id);
    
    res.json({
      keys: keys.map(key => key.toSafeObject())
    });
  })
);

// @route   POST /api/api-keys
// @desc    Create new API key
// @access  Private
router.post('/',
  authenticate,
  apiKeyLimiter,
  validate(schemas.createApiKey),
  asyncHandler(async (req, res) => {
    const { name, permissions, rate_limit, expires_in_days } = req.body;

    // Calculate expiration date if specified
    let expires_at = null;
    if (expires_in_days) {
      expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + expires_in_days);
      expires_at = expires_at.toISOString();
    }

    // Create API key
    const result = await ApiKey.create({
      name,
      user_id: req.user.id,
      permissions: permissions || ['read'],
      rate_limit: rate_limit || 1000,
      expires_at
    });

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: result.apiKey, // Only returned on creation
      keyData: result.keyData.toSafeObject()
    });
  })
);

// @route   GET /api/api-keys/:id
// @desc    Get specific API key details
// @access  Private
router.get('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const keyId = parseInt(req.params.id);
    const apiKey = await ApiKey.findById(keyId);

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    // Verify ownership
    if (apiKey.user_id !== req.user.id && req.user.role !== 'admin') {
      throw new NotFoundError('API key not found');
    }

    res.json({
      key: apiKey.toSafeObject()
    });
  })
);

// @route   PUT /api/api-keys/:id
// @desc    Update API key
// @access  Private
router.put('/:id',
  authenticate,
  validate(schemas.updateApiKey),
  asyncHandler(async (req, res) => {
    const keyId = parseInt(req.params.id);
    const apiKey = await ApiKey.findById(keyId);

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    // Verify ownership
    if (apiKey.user_id !== req.user.id && req.user.role !== 'admin') {
      throw new NotFoundError('API key not found');
    }

    const { name, permissions, rate_limit, expires_in_days } = req.body;

    // Calculate new expiration date if specified
    let expires_at = undefined;
    if (expires_in_days !== undefined) {
      if (expires_in_days === null) {
        expires_at = null; // Remove expiration
      } else {
        expires_at = new Date();
        expires_at.setDate(expires_at.getDate() + expires_in_days);
        expires_at = expires_at.toISOString();
      }
    }

    const updatedKey = await apiKey.update({
      name,
      permissions,
      rate_limit,
      expires_at
    });

    res.json({
      message: 'API key updated successfully',
      key: updatedKey.toSafeObject()
    });
  })
);

// @route   DELETE /api/api-keys/:id
// @desc    Revoke API key
// @access  Private
router.delete('/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const keyId = parseInt(req.params.id);
    const apiKey = await ApiKey.findById(keyId);

    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    // Verify ownership
    if (apiKey.user_id !== req.user.id && req.user.role !== 'admin') {
      throw new NotFoundError('API key not found');
    }

    await apiKey.revoke();

    res.json({
      message: 'API key revoked successfully'
    });
  })
);

// @route   POST /api/api-keys/:id/rotate
// @desc    Rotate API key (revoke old, create new)
// @access  Private
router.post('/:id/rotate',
  authenticate,
  apiKeyLimiter,
  asyncHandler(async (req, res) => {
    const keyId = parseInt(req.params.id);
    const oldKey = await ApiKey.findById(keyId);

    if (!oldKey) {
      throw new NotFoundError('API key not found');
    }

    // Verify ownership
    if (oldKey.user_id !== req.user.id && req.user.role !== 'admin') {
      throw new NotFoundError('API key not found');
    }

    // Revoke old key
    await oldKey.revoke();

    // Create new key with same settings
    const result = await ApiKey.create({
      name: `${oldKey.name} (rotated)`,
      user_id: oldKey.user_id,
      permissions: oldKey.permissions,
      rate_limit: oldKey.rate_limit,
      expires_at: oldKey.expires_at
    });

    res.json({
      message: 'API key rotated successfully',
      apiKey: result.apiKey, // New key only returned on creation
      keyData: result.keyData.toSafeObject()
    });
  })
);

// @route   GET /api/api-keys/usage/stats
// @desc    Get API key usage statistics
// @access  Private
router.get('/usage/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Get usage stats for user's API keys
    const sql = `
      SELECT 
        ak.id,
        ak.name,
        COUNT(aku.id) as total_requests,
        COUNT(DISTINCT DATE(aku.created_at)) as active_days,
        MAX(aku.created_at) as last_used
      FROM api_keys ak
      LEFT JOIN api_key_usage aku ON ak.id = aku.key_id
      WHERE ak.user_id = ?
      GROUP BY ak.id
    `;

    const stats = await Database.query(sql, [userId]);

    res.json({
      stats
    });
  })
);

// Admin routes

// @route   GET /api/api-keys/admin/all
// @desc    Get all API keys (admin only)
// @access  Admin
router.get('/admin/all',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const sql = `
      SELECT 
        ak.*,
        u.username,
        u.email
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      ORDER BY ak.created_at DESC
    `;

    const keys = await Database.query(sql);

    res.json({
      keys: keys.map(key => ({
        ...new ApiKey(key).toSafeObject(),
        username: key.username,
        email: key.email
      }))
    });
  })
);

export default router;