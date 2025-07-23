import express from 'express';
import Product from '../models/Product.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { asyncHandler, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { apiLimiter, securityHeaders } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply security headers to all product routes
router.use(securityHeaders);

// @route   GET /api/v1/products
// @desc    Get all products with pagination and filters
// @access  Public
router.get('/',
  validate(schemas.productQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await Product.findAll(req.query);
    
    res.json({
      success: true,
      data: result.products.map(p => p.toSafeObject()),
      pagination: result.pagination
    });
  })
);

// @route   GET /api/v1/products/low-stock
// @desc    Get products with low stock
// @access  Private (Admin/Manager)
router.get('/low-stock',
  authenticate,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 10;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Product.findLowStock(threshold, { page, limit });
    
    res.json({
      success: true,
      threshold,
      data: result.products.map(p => p.toSafeObject()),
      pagination: result.pagination
    });
  })
);

// @route   GET /api/v1/products/statistics
// @desc    Get product statistics
// @access  Private
router.get('/statistics',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const stats = await Product.getStatistics(userId);
    
    res.json({
      success: true,
      data: stats
    });
  })
);

// @route   GET /api/v1/products/:id
// @desc    Get product by ID
// @access  Public
router.get('/:id',
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    res.json({
      success: true,
      data: product.toSafeObject()
    });
  })
);

// @route   POST /api/v1/products
// @desc    Create a new product
// @access  Private (Admin/Manager)
router.post('/',
  authenticate,
  authorize(['admin', 'manager']),
  validate(schemas.createProduct),
  asyncHandler(async (req, res) => {
    const productData = {
      ...req.body,
      created_by: req.user.id
    };
    
    // Check if SKU already exists
    if (productData.sku) {
      const existingProduct = await Product.findBySku(productData.sku);
      if (existingProduct) {
        throw new ConflictError('Product with this SKU already exists');
      }
    }
    
    const product = await Product.create(productData);
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product.toSafeObject()
    });
  })
);

// @route   PUT /api/v1/products/:id
// @desc    Update product
// @access  Private (Admin/Manager or Creator)
router.put('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  validate(schemas.updateProduct),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && 
        req.user.role !== 'manager' && 
        product.created_by !== req.user.id) {
      throw new ForbiddenError('You do not have permission to update this product');
    }
    
    // Check if SKU is being changed and already exists
    if (req.body.sku && req.body.sku !== product.sku) {
      const existingProduct = await Product.findBySku(req.body.sku);
      if (existingProduct) {
        throw new ConflictError('Product with this SKU already exists');
      }
    }
    
    const updatedProduct = await product.update(req.body);
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct.toSafeObject()
    });
  })
);

// @route   PATCH /api/v1/products/:id/stock
// @desc    Update product stock
// @access  Private (Admin/Manager)
router.patch('/:id/stock',
  authenticate,
  authorize(['admin', 'manager']),
  validate(schemas.idParam, 'params'),
  validate(schemas.updateStock),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    const { quantity, operation } = req.body;
    
    // Validate stock operation
    if (operation === 'decrement' && quantity > product.stock_quantity) {
      throw new ValidationError('Cannot decrement stock below zero');
    }
    
    await product.updateStock(quantity, operation);
    
    res.json({
      success: true,
      message: `Stock ${operation}ed successfully`,
      data: {
        id: product.id,
        name: product.name,
        stock_quantity: product.stock_quantity
      }
    });
  })
);

// @route   DELETE /api/v1/products/:id
// @desc    Delete product (soft delete)
// @access  Private (Admin/Manager or Creator)
router.delete('/:id',
  authenticate,
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && 
        req.user.role !== 'manager' && 
        product.created_by !== req.user.id) {
      throw new ForbiddenError('You do not have permission to delete this product');
    }
    
    await product.delete();
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  })
);

// @route   DELETE /api/v1/products/:id/permanent
// @desc    Permanently delete product
// @access  Private (Admin only)
router.delete('/:id/permanent',
  authenticate,
  authorize(['admin']),
  validate(schemas.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    
    await product.hardDelete();
    
    res.json({
      success: true,
      message: 'Product permanently deleted'
    });
  })
);

// @route   GET /api/v1/products/category/:categoryId
// @desc    Get products by category
// @access  Public
router.get('/category/:categoryId',
  asyncHandler(async (req, res) => {
    const categoryId = parseInt(req.params.categoryId);
    const result = await Product.findByCategory(categoryId, req.query);
    
    res.json({
      success: true,
      category_id: categoryId,
      data: result.products.map(p => p.toSafeObject()),
      pagination: result.pagination
    });
  })
);

export default router;