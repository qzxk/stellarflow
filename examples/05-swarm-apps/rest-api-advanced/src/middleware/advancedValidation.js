const Joi = require('joi');
const validator = require('validator');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Advanced Input Validation and Sanitization Middleware
 * Provides comprehensive input validation, sanitization, and business logic validation
 */

class AdvancedValidation {
  constructor() {
    this.redis = null;
    this.initializeRedis();
    
    // Custom validation rules
    this.customValidators = {
      strongPassword: this.createStrongPasswordValidator(),
      sqlSafeString: this.createSQLSafeValidator(),
      businessEmail: this.createBusinessEmailValidator(),
      secureUrl: this.createSecureUrlValidator(),
      phoneNumber: this.createPhoneValidator(),
      creditCard: this.createCreditCardValidator()
    };
  }

  async initializeRedis() {
    this.redis = getRedisClient();
  }

  /**
   * Create comprehensive validation middleware
   */
  validate(schema, options = {}) {
    return async (req, res, next) => {
      try {
        const validationOptions = {
          abortEarly: false,
          allowUnknown: false,
          stripUnknown: true,
          convert: true,
          ...options
        };

        // Pre-validation sanitization
        this.sanitizeRequest(req);

        // Validate request parts
        const errors = {};
        const validatedData = {};

        for (const part of ['params', 'query', 'body', 'headers']) {
          if (schema[part]) {
            const { error, value } = schema[part].validate(req[part], validationOptions);
            
            if (error) {
              errors[part] = this.formatValidationErrors(error);
            } else {
              validatedData[part] = value;
              req[part] = value; // Replace with validated/sanitized data
            }
          }
        }

        // Business logic validation
        if (schema.businessRules && Object.keys(errors).length === 0) {
          const businessErrors = await this.validateBusinessRules(
            schema.businessRules, 
            validatedData, 
            req
          );
          if (businessErrors.length > 0) {
            errors.business = businessErrors;
          }
        }

        // Check for validation errors
        if (Object.keys(errors).length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors,
            requestId: req.id
          });
        }

        // Log successful validation for monitoring
        await this.logValidationSuccess(req, schema);

        next();
      } catch (error) {
        logger.error('Validation middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal validation error',
          requestId: req.id
        });
      }
    };
  }

  /**
   * Sanitize request data before validation
   */
  sanitizeRequest(req) {
    // Sanitize strings in body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = this.sanitizeObject(req.params);
    }
  }

  /**
   * Recursively sanitize object properties
   */
  sanitizeObject(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // HTML escape
        sanitized[key] = validator.escape(value.trim());
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? validator.escape(item.trim()) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Format validation errors for consistent response
   */
  formatValidationErrors(error) {
    return error.details.reduce((acc, detail) => {
      const field = detail.path.join('.');
      acc[field] = {
        message: detail.message,
        value: detail.context.value,
        type: detail.type
      };
      return acc;
    }, {});
  }

  /**
   * Validate business rules
   */
  async validateBusinessRules(rules, data, req) {
    const errors = [];

    for (const rule of rules) {
      try {
        const isValid = await this.executeBusinessRule(rule, data, req);
        if (!isValid) {
          errors.push({
            rule: rule.name,
            message: rule.message,
            field: rule.field
          });
        }
      } catch (error) {
        logger.error(`Business rule validation error for ${rule.name}:`, error);
        errors.push({
          rule: rule.name,
          message: 'Business rule validation failed',
          field: rule.field
        });
      }
    }

    return errors;
  }

  /**
   * Execute individual business rule
   */
  async executeBusinessRule(rule, data, req) {
    switch (rule.type) {
      case 'uniqueEmail':
        return await this.checkUniqueEmail(data.body?.email, req.user?.id);
      
      case 'passwordHistory':
        return await this.checkPasswordHistory(data.body?.password, req.user?.id);
      
      case 'rateLimitRule':
        return await this.checkCustomRateLimit(rule, req);
      
      case 'duplicateContent':
        return await this.checkDuplicateContent(rule.field, data.body?.[rule.field], req);
      
      case 'custom':
        return await rule.validator(data, req);
      
      default:
        return true;
    }
  }

  /**
   * Check email uniqueness
   */
  async checkUniqueEmail(email, currentUserId) {
    if (!email) return true;
    
    // This would typically check your database
    // For demonstration, using Redis cache
    if (this.redis) {
      const existingUser = await this.redis.get(`email:${email.toLowerCase()}`);
      return !existingUser || existingUser === currentUserId;
    }
    
    return true;
  }

  /**
   * Check password against history
   */
  async checkPasswordHistory(password, userId) {
    if (!password || !userId) return true;
    
    if (this.redis) {
      const historyKey = `password_history:${userId}`;
      const history = await this.redis.lrange(historyKey, 0, 4); // Last 5 passwords
      
      // In real implementation, you'd hash the password and compare
      return !history.includes(password);
    }
    
    return true;
  }

  /**
   * Check custom rate limits
   */
  async checkCustomRateLimit(rule, req) {
    if (!this.redis) return true;
    
    const key = `custom_rate:${rule.name}:${req.ip}`;
    const count = await this.redis.incr(key);
    
    if (count === 1) {
      await this.redis.expire(key, rule.windowSeconds);
    }
    
    return count <= rule.maxRequests;
  }

  /**
   * Check for duplicate content
   */
  async checkDuplicateContent(field, value, req) {
    if (!value || !this.redis) return true;
    
    const contentHash = require('crypto')
      .createHash('sha256')
      .update(value)
      .digest('hex');
    
    const key = `content:${field}:${contentHash}`;
    const existing = await this.redis.get(key);
    
    return !existing;
  }

  /**
   * Log successful validation
   */
  async logValidationSuccess(req, schema) {
    const logData = {
      type: 'VALIDATION_SUCCESS',
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      schemaType: schema.name || 'unnamed',
      timestamp: new Date().toISOString()
    };

    if (this.redis) {
      const key = `validation_logs:${new Date().toISOString().split('T')[0]}`;
      await this.redis.lpush(key, JSON.stringify(logData));
      await this.redis.expire(key, 86400 * 7); // 7 days retention
    }
  }

  /**
   * Create strong password validator
   */
  createStrongPasswordValidator() {
    return Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must not exceed 128 characters'
      });
  }

  /**
   * Create SQL-safe string validator
   */
  createSQLSafeValidator() {
    return Joi.string()
      .pattern(/^[^'"`;\\]*$/)
      .messages({
        'string.pattern.base': 'Input contains potentially dangerous characters'
      });
  }

  /**
   * Create business email validator
   */
  createBusinessEmailValidator() {
    return Joi.string()
      .email()
      .custom((value, helpers) => {
        // Block common disposable email domains
        const disposableDomains = [
          '10minutemail.com',
          'tempmail.org',
          'guerrillamail.com',
          'mailinator.com'
        ];
        
        const domain = value.split('@')[1]?.toLowerCase();
        if (disposableDomains.includes(domain)) {
          return helpers.error('custom.disposableEmail');
        }
        
        return value;
      })
      .messages({
        'custom.disposableEmail': 'Disposable email addresses are not allowed'
      });
  }

  /**
   * Create secure URL validator
   */
  createSecureUrlValidator() {
    return Joi.string()
      .uri({ scheme: ['https'] })
      .custom((value, helpers) => {
        // Block dangerous domains
        const dangerousDomains = [
          'bit.ly',
          'tinyurl.com',
          'short.link'
        ];
        
        try {
          const url = new URL(value);
          if (dangerousDomains.some(domain => url.hostname.includes(domain))) {
            return helpers.error('custom.dangerousDomain');
          }
        } catch {
          return helpers.error('string.uri');
        }
        
        return value;
      })
      .messages({
        'custom.dangerousDomain': 'URL from blocked domain'
      });
  }

  /**
   * Create phone number validator
   */
  createPhoneValidator() {
    return Joi.string()
      .custom((value, helpers) => {
        if (!validator.isMobilePhone(value, 'any', { strictMode: false })) {
          return helpers.error('custom.invalidPhone');
        }
        return value;
      })
      .messages({
        'custom.invalidPhone': 'Invalid phone number format'
      });
  }

  /**
   * Create credit card validator
   */
  createCreditCardValidator() {
    return Joi.string()
      .custom((value, helpers) => {
        if (!validator.isCreditCard(value)) {
          return helpers.error('custom.invalidCreditCard');
        }
        return value;
      })
      .messages({
        'custom.invalidCreditCard': 'Invalid credit card number'
      });
  }

  /**
   * File upload validation
   */
  createFileValidator(options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
      maxFiles = 1
    } = options;

    return {
      fileFilter: (req, file, cb) => {
        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(new Error(`File type ${file.mimetype} not allowed`));
        }

        // Check file name for suspicious patterns
        if (/[<>:"/\\|?*]/.test(file.originalname)) {
          return cb(new Error('Invalid file name'));
        }

        cb(null, true);
      },
      limits: {
        fileSize: maxSize,
        files: maxFiles
      }
    };
  }

  /**
   * Create comprehensive user registration schema
   */
  createUserRegistrationSchema() {
    return {
      name: 'userRegistration',
      body: Joi.object({
        email: this.customValidators.businessEmail.required(),
        password: this.customValidators.strongPassword.required(),
        confirmPassword: Joi.string()
          .valid(Joi.ref('password'))
          .required()
          .messages({
            'any.only': 'Password confirmation does not match'
          }),
        name: Joi.string()
          .min(2)
          .max(50)
          .pattern(/^[a-zA-Z\s'-]+$/)
          .required()
          .messages({
            'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
          }),
        phone: this.customValidators.phoneNumber.optional(),
        dateOfBirth: Joi.date()
          .max('now')
          .min('1900-01-01')
          .optional(),
        address: Joi.object({
          street: Joi.string().max(100).optional(),
          city: Joi.string().max(50).optional(),
          state: Joi.string().max(50).optional(),
          zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
          country: Joi.string().length(2).uppercase().optional()
        }).optional(),
        terms: Joi.boolean().valid(true).required().messages({
          'any.only': 'You must accept the terms and conditions'
        })
      }),
      businessRules: [
        {
          name: 'uniqueEmail',
          type: 'uniqueEmail',
          field: 'email',
          message: 'Email address is already registered'
        }
      ]
    };
  }

  /**
   * Create product creation schema
   */
  createProductSchema() {
    return {
      name: 'productCreation',
      body: Joi.object({
        name: Joi.string()
          .min(3)
          .max(100)
          .required(),
        description: Joi.string()
          .min(10)
          .max(1000)
          .required(),
        price: Joi.number()
          .positive()
          .precision(2)
          .required(),
        category: Joi.string()
          .valid('electronics', 'clothing', 'books', 'home', 'sports')
          .required(),
        tags: Joi.array()
          .items(Joi.string().max(20))
          .max(10)
          .optional(),
        images: Joi.array()
          .items(this.customValidators.secureUrl)
          .max(5)
          .optional(),
        inStock: Joi.boolean().default(true),
        stockQuantity: Joi.number().integer().min(0).optional()
      }),
      businessRules: [
        {
          name: 'duplicateProduct',
          type: 'duplicateContent',
          field: 'name',
          message: 'Product with this name already exists'
        }
      ]
    };
  }

  /**
   * Get validation statistics
   */
  async getValidationStats() {
    if (!this.redis) return null;

    try {
      const today = new Date().toISOString().split('T')[0];
      const logs = await this.redis.lrange(`validation_logs:${today}`, 0, -1);
      
      const stats = {
        totalValidations: logs.length,
        byEndpoint: {},
        byMethod: {},
        topUserAgents: {},
        errors: 0
      };

      logs.forEach(log => {
        const data = JSON.parse(log);
        stats.byEndpoint[data.url] = (stats.byEndpoint[data.url] || 0) + 1;
        stats.byMethod[data.method] = (stats.byMethod[data.method] || 0) + 1;
        stats.topUserAgents[data.userAgent] = (stats.topUserAgents[data.userAgent] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get validation stats:', error);
      return null;
    }
  }
}

// Create singleton instance
const advancedValidation = new AdvancedValidation();

module.exports = {
  AdvancedValidation,
  advancedValidation,
  validate: (schema, options) => advancedValidation.validate(schema, options),
  createFileValidator: (options) => advancedValidation.createFileValidator(options),
  createUserRegistrationSchema: () => advancedValidation.createUserRegistrationSchema(),
  createProductSchema: () => advancedValidation.createProductSchema(),
  getValidationStats: () => advancedValidation.getValidationStats(),
  customValidators: advancedValidation.customValidators
};