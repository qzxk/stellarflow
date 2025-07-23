import Joi from 'joi';
import { ValidationError } from './errorHandler.js';

// Validation middleware factory
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      throw new ValidationError('Validation failed', details);
    }
    
    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // API Key schemas
  createApiKey: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    permissions: Joi.array().items(Joi.string()).default(['read']),
    rate_limit: Joi.number().integer().min(1).max(10000).default(1000),
    expires_in_days: Joi.number().integer().min(1).max(365).optional()
  }),
  
  updateApiKey: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
    rate_limit: Joi.number().integer().min(1).max(10000).optional(),
    expires_in_days: Joi.number().integer().min(1).max(365).allow(null).optional()
  }),

  // 2FA schemas
  enable2FA: Joi.object({
    token: Joi.string().length(6).pattern(/^\d+$/).required()
      .messages({
        'string.length': '2FA code must be exactly 6 digits',
        'string.pattern.base': '2FA code must contain only numbers'
      })
  }),

  verify2FA: Joi.object({
    userId: Joi.number().integer().required(),
    token: Joi.string().required(),
    isBackupCode: Joi.boolean().default(false)
  }),

  disable2FA: Joi.object({
    password: Joi.string().required(),
    token: Joi.string().length(6).pattern(/^\d+$/).required()
  }),

  regenerateBackupCodes: Joi.object({
    password: Joi.string().required(),
    token: Joi.string().length(6).pattern(/^\d+$/).required()
  }),

  // User schemas
  registerUser: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.alphanum': 'Username must contain only alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 50 characters'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)  
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    bio: Joi.string().max(500).optional()
  }),
  
  loginUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  updateUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).optional(),
    email: Joi.string().email().optional(),
    first_name: Joi.string().max(100).optional(),
    last_name: Joi.string().max(100).optional(),
    avatar_url: Joi.string().uri().optional(),
    bio: Joi.string().max(500).optional()
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
  }),
  
  // Post schemas
  createPost: Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 200 characters'
      }),
    content: Joi.string()
      .min(1)
      .required()
      .messages({
        'string.min': 'Content cannot be empty'
      }),
    excerpt: Joi.string().max(500).optional(),
    status: Joi.string().valid('draft', 'published').default('published'),
    featured_image: Joi.string().uri().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().max(50)),
        Joi.string()
      )
      .optional()
  }),
  
  updatePost: Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    content: Joi.string().min(1).optional(),
    excerpt: Joi.string().max(500).optional(),
    status: Joi.string().valid('draft', 'published').optional(),
    featured_image: Joi.string().uri().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().max(50)),
        Joi.string()
      )
      .optional()
  }),
  
  // Comment schemas
  createComment: Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Comment cannot be empty',
        'string.max': 'Comment cannot exceed 1000 characters'
      }),
    parent_id: Joi.number().integer().positive().optional()
  }),
  
  updateComment: Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
  }),
  
  // Query parameter schemas
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('created_at', 'updated_at', 'title', 'view_count', 'like_count').default('created_at'),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  searchQuery: Joi.object({
    q: Joi.string().min(1).max(100).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),
  
  // ID parameter validation
  idParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  // Product schemas
  createProduct: Joi.object({
    name: Joi.string()
      .min(1)
      .max(200)
      .required()
      .messages({
        'string.min': 'Product name cannot be empty',
        'string.max': 'Product name cannot exceed 200 characters'
      }),
    description: Joi.string()
      .max(2000)
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    price: Joi.number()
      .positive()
      .precision(2)
      .required()
      .messages({
        'number.positive': 'Price must be a positive number',
        'number.base': 'Price must be a valid number'
      }),
    stock_quantity: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .messages({
        'number.min': 'Stock quantity cannot be negative'
      }),
    category_id: Joi.number().integer().positive().optional(),
    sku: Joi.string()
      .alphanum()
      .uppercase()
      .max(50)
      .optional()
      .messages({
        'string.alphanum': 'SKU must contain only alphanumeric characters'
      }),
    image_url: Joi.string().uri().optional(),
    weight: Joi.number().positive().optional(),
    dimensions: Joi.string().max(100).optional(),
    is_active: Joi.boolean().default(true)
  }),

  updateProduct: Joi.object({
    name: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(2000).optional(),
    price: Joi.number().positive().precision(2).optional(),
    stock_quantity: Joi.number().integer().min(0).optional(),
    category_id: Joi.number().integer().positive().optional(),
    sku: Joi.string().alphanum().uppercase().max(50).optional(),
    image_url: Joi.string().uri().optional(),
    weight: Joi.number().positive().optional(),
    dimensions: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional()
  }),

  updateStock: Joi.object({
    quantity: Joi.number()
      .integer()
      .required()
      .messages({
        'number.base': 'Quantity must be a valid number'
      }),
    operation: Joi.string()
      .valid('set', 'increment', 'decrement')
      .default('set')
  }),

  // Product query parameters
  productQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    category_id: Joi.number().integer().positive().optional(),
    min_price: Joi.number().positive().optional(),
    max_price: Joi.number().positive().optional(),
    search: Joi.string().max(100).optional(),
    sort_by: Joi.string().valid('name', 'price', 'created_at', 'updated_at', 'stock_quantity').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc'),
    is_active: Joi.boolean().optional(),
    in_stock_only: Joi.boolean().default(false)
  })
};

// Sanitization helpers
export const sanitize = {
  // Remove HTML tags and trim whitespace
  text: (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  },
  
  // Sanitize HTML content (basic)
  html: (str) => {
    if (typeof str !== 'string') return str;
    // Allow basic HTML tags
    const allowedTags = /<\/?(?:p|br|strong|em|u|h[1-6]|ul|ol|li|blockquote|a|img)(?:\s[^>]*)?>|/gi;
    return str.replace(/(?!allowedTags)<[^>]*>/g, '').trim();
  },
  
  // Sanitize array of tags
  tags: (tags) => {
    if (Array.isArray(tags)) {
      return tags
        .map(tag => sanitize.text(tag))
        .filter(tag => tag.length > 0)
        .slice(0, 10); // Limit to 10 tags
    }
    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map(tag => sanitize.text(tag))
        .filter(tag => tag.length > 0)
        .slice(0, 10);
    }
    return [];
  }
};