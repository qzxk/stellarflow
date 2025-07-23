import Joi from 'joi';

// Product validation schemas
export const productSchemas = {
  // Create product schema
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(255)
      .trim()
      .required()
      .messages({
        'string.empty': 'Product name is required',
        'string.max': 'Product name must not exceed 255 characters',
      }),
    
    description: Joi.string()
      .max(5000)
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description must not exceed 5000 characters',
      }),
    
    price: Joi.number()
      .min(0)
      .precision(2)
      .required()
      .messages({
        'number.base': 'Price must be a number',
        'number.min': 'Price must be non-negative',
        'any.required': 'Price is required',
      }),
    
    sku: Joi.string()
      .max(100)
      .trim()
      .pattern(/^[A-Z0-9-]+$/)
      .optional()
      .messages({
        'string.max': 'SKU must not exceed 100 characters',
        'string.pattern.base': 'SKU must contain only uppercase letters, numbers, and hyphens',
      }),
    
    category: Joi.string()
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.max': 'Category must not exceed 100 characters',
      }),
    
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 tags allowed',
        'string.max': 'Each tag must not exceed 50 characters',
      }),
    
    stock_quantity: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.min': 'Stock quantity must be non-negative',
        'number.integer': 'Stock quantity must be a whole number',
      }),
    
    is_available: Joi.boolean()
      .default(true),
  }),

  // Update product schema
  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(255)
      .trim()
      .optional()
      .messages({
        'string.empty': 'Product name cannot be empty',
        'string.max': 'Product name must not exceed 255 characters',
      }),
    
    description: Joi.string()
      .max(5000)
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description must not exceed 5000 characters',
      }),
    
    price: Joi.number()
      .min(0)
      .precision(2)
      .optional()
      .messages({
        'number.base': 'Price must be a number',
        'number.min': 'Price must be non-negative',
      }),
    
    sku: Joi.string()
      .max(100)
      .trim()
      .pattern(/^[A-Z0-9-]+$/)
      .optional()
      .messages({
        'string.max': 'SKU must not exceed 100 characters',
        'string.pattern.base': 'SKU must contain only uppercase letters, numbers, and hyphens',
      }),
    
    category: Joi.string()
      .max(100)
      .trim()
      .optional()
      .messages({
        'string.max': 'Category must not exceed 100 characters',
      }),
    
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Maximum 10 tags allowed',
        'string.max': 'Each tag must not exceed 50 characters',
      }),
    
    stock_quantity: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Stock quantity must be non-negative',
        'number.integer': 'Stock quantity must be a whole number',
      }),
    
    is_available: Joi.boolean()
      .optional(),
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update',
  }),

  // Update stock schema
  updateStock: Joi.object({
    quantity: Joi.number()
      .integer()
      .required()
      .messages({
        'number.integer': 'Quantity must be a whole number',
        'any.required': 'Quantity is required',
      }),
    
    operation: Joi.string()
      .valid('set', 'increment', 'decrement')
      .default('set')
      .messages({
        'any.only': 'Operation must be one of: set, increment, decrement',
      }),
  }),

  // Query parameters schema
  query: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.min': 'Page must be at least 1',
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100',
      }),
    
    category: Joi.string()
      .trim()
      .optional(),
    
    minPrice: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Minimum price must be non-negative',
      }),
    
    maxPrice: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Maximum price must be non-negative',
      }),
    
    search: Joi.string()
      .trim()
      .optional(),
    
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim()),
        Joi.string().trim()
      )
      .optional(),
    
    inStockOnly: Joi.boolean()
      .default(false),
    
    isAvailable: Joi.boolean()
      .optional(),
    
    sortBy: Joi.string()
      .valid('name', 'price', 'created_at', 'updated_at', 'stock_quantity', 'category')
      .default('created_at')
      .messages({
        'any.only': 'Invalid sort field',
      }),
    
    sortOrder: Joi.string()
      .valid('ASC', 'DESC', 'asc', 'desc')
      .default('DESC')
      .messages({
        'any.only': 'Sort order must be ASC or DESC',
      }),
  }),

  // Bulk price update schema
  bulkPriceUpdate: Joi.array()
    .items(
      Joi.object({
        id: Joi.string()
          .uuid()
          .required()
          .messages({
            'string.guid': 'Invalid product ID format',
            'any.required': 'Product ID is required',
          }),
        
        price: Joi.number()
          .min(0)
          .precision(2)
          .optional()
          .messages({
            'number.min': 'Price must be non-negative',
          }),
        
        percentage: Joi.number()
          .min(-100)
          .max(1000)
          .optional()
          .messages({
            'number.min': 'Percentage decrease cannot exceed 100%',
            'number.max': 'Percentage increase cannot exceed 1000%',
          }),
      })
      .xor('price', 'percentage')
      .messages({
        'object.xor': 'Provide either price or percentage, not both',
      })
    )
    .min(1)
    .max(100)
    .messages({
      'array.min': 'At least one product update is required',
      'array.max': 'Maximum 100 products can be updated at once',
    }),

  // ID parameter schema
  id: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.guid': 'Invalid product ID format',
        'any.required': 'Product ID is required',
      }),
  }),
};

// Validation middleware factory
export function validateProduct(schema) {
  return (req, res, next) => {
    const { error, value } = productSchemas[schema].validate(
      req.body || req.query || req.params,
      {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      }
    );

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Replace request data with validated and sanitized values
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = value;
    } else if (req.query && Object.keys(req.query).length > 0) {
      req.query = value;
    } else if (req.params) {
      req.params = { ...req.params, ...value };
    }

    next();
  };
}

// Custom validation functions
export const customValidators = {
  // Check if SKU is unique (excluding a specific product)
  isSkuUnique: async (sku, excludeId = null) => {
    const ProductRepository = (await import('../repositories/ProductRepository.js')).default;
    const exists = await ProductRepository.skuExists(sku, excludeId);
    return !exists;
  },

  // Validate price range
  isPriceRangeValid: (minPrice, maxPrice) => {
    if (minPrice === undefined || maxPrice === undefined) return true;
    return minPrice <= maxPrice;
  },

  // Validate tags format
  validateTags: (tags) => {
    if (!Array.isArray(tags)) return false;
    return tags.every(tag => 
      typeof tag === 'string' && 
      tag.length > 0 && 
      tag.length <= 50
    );
  },

  // Validate stock update operation
  validateStockOperation: (currentStock, quantity, operation) => {
    switch (operation) {
      case 'decrement':
        return currentStock >= quantity;
      case 'increment':
      case 'set':
        return quantity >= 0;
      default:
        return false;
    }
  },
};

// Export validation schemas for testing
export default productSchemas;