const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Smart Rate Limiting Middleware
 * Provides adaptive rate limiting based on user behavior, endpoint sensitivity, and threat detection
 */

class SmartRateLimit {
  constructor() {
    this.redis = null;
    this.initializeRedis();
    
    // Rate limit configurations for different endpoint types
    this.configs = {
      // Authentication endpoints - most restrictive
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: 'Too many authentication attempts, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        keyGenerator: (req) => `auth:${this.getClientIP(req)}`,
        onLimitReached: this.handleAuthLimitReached.bind(this)
      },
      
      // API endpoints - moderate restrictions
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window
        message: 'Rate limit exceeded, please slow down',
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `api:${this.getClientIP(req)}:${req.user?.id || 'anonymous'}`,
        skip: this.skipTrustedUsers.bind(this)
      },
      
      // Write operations - more restrictive
      write: {
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 20, // 20 write operations per window
        message: 'Too many write operations, please wait',
        keyGenerator: (req) => `write:${this.getClientIP(req)}:${req.user?.id || 'anonymous'}`
      },
      
      // File uploads - very restrictive
      upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 uploads per hour
        message: 'Upload limit exceeded, please try again later',
        keyGenerator: (req) => `upload:${this.getClientIP(req)}:${req.user?.id || 'anonymous'}`
      },
      
      // Password reset - highly restrictive
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 attempts per hour
        message: 'Too many password reset attempts',
        keyGenerator: (req) => `pwd_reset:${this.getClientIP(req)}`
      },
      
      // Public endpoints - lenient
      public: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per window
        message: 'Rate limit exceeded',
        keyGenerator: (req) => `public:${this.getClientIP(req)}`
      }
    };
    
    // Adaptive rate limiting factors
    this.adaptiveFactors = {
      userReputation: new Map(), // User reputation scores
      endpointHealth: new Map(), // Endpoint health metrics
      globalLoad: 0 // Global system load
    };
  }

  async initializeRedis() {
    this.redis = getRedisClient();
    if (this.redis) {
      logger.info('Smart rate limiter connected to Redis');
      this.startAdaptiveMonitoring();
    }
  }

  /**
   * Create rate limiter for specific endpoint type
   */
  createLimiter(type = 'api', customConfig = {}) {
    const config = { ...this.configs[type], ...customConfig };
    
    // Use Redis store if available
    if (this.redis) {
      config.store = this.createRedisStore();
    }
    
    // Add adaptive logic
    config.skip = this.createAdaptiveSkip(config.skip);
    config.max = this.createAdaptiveMax(config.max);
    
    return rateLimit(config);
  }

  /**
   * Create Redis store for rate limiting
   */
  createRedisStore() {
    return {
      incr: async (key, cb) => {
        try {
          const count = await this.redis.incr(key);
          if (count === 1) {
            await this.redis.expire(key, Math.ceil(this.configs.api.windowMs / 1000));
          }
          cb(null, count, new Date(Date.now() + this.configs.api.windowMs));
        } catch (error) {
          cb(error);
        }
      },
      
      decrement: async (key) => {
        try {
          await this.redis.decr(key);
        } catch (error) {
          logger.error('Redis decrement error:', error);
        }
      },
      
      resetKey: async (key) => {
        try {
          await this.redis.del(key);
        } catch (error) {
          logger.error('Redis reset key error:', error);
        }
      }
    };
  }

  /**
   * Create adaptive skip function
   */
  createAdaptiveSkip(originalSkip) {
    return (req, res) => {
      // Apply original skip logic first
      if (originalSkip && originalSkip(req, res)) {
        return true;
      }
      
      // Skip for trusted users with high reputation
      const userReputation = this.getUserReputation(req);
      if (userReputation > 0.8) {
        return true;
      }
      
      // Skip for health check endpoints
      if (req.path.includes('/health') || req.path.includes('/status')) {
        return true;
      }
      
      // Skip for high-priority users (premium accounts, etc.)
      if (req.user && req.user.priority === 'high') {
        return true;
      }
      
      return false;
    };
  }

  /**
   * Create adaptive max function
   */
  createAdaptiveMax(baseMax) {
    return (req, res) => {
      let adjustedMax = baseMax;
      
      // Adjust based on user reputation
      const userReputation = this.getUserReputation(req);
      if (userReputation > 0.9) {
        adjustedMax *= 2; // Double limit for highly trusted users
      } else if (userReputation < 0.3) {
        adjustedMax = Math.ceil(adjustedMax * 0.5); // Halve limit for suspicious users
      }
      
      // Adjust based on endpoint health
      const endpointHealth = this.getEndpointHealth(req.path);
      if (endpointHealth < 0.5) {
        adjustedMax = Math.ceil(adjustedMax * 0.7); // Reduce limit for unhealthy endpoints
      }
      
      // Adjust based on global system load
      if (this.adaptiveFactors.globalLoad > 0.8) {
        adjustedMax = Math.ceil(adjustedMax * 0.6); // Reduce limits during high load
      }
      
      return Math.max(1, adjustedMax); // Ensure at least 1 request is allowed
    };
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.headers['cf-connecting-ip'] ||
           req.headers['x-real-ip'] ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip;
  }

  /**
   * Skip trusted users
   */
  skipTrustedUsers(req, res) {
    // Skip for authenticated admin users
    if (req.user && req.user.role === 'admin') {
      return true;
    }
    
    // Skip for internal service requests
    if (req.headers['x-internal-request'] === 'true') {
      return true;
    }
    
    return false;
  }

  /**
   * Handle authentication limit reached
   */
  async handleAuthLimitReached(req, res, next) {
    const clientIP = this.getClientIP(req);
    
    // Log security event
    logger.warn('Authentication rate limit reached', {
      ip: clientIP,
      userAgent: req.get('user-agent'),
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    // Increase user suspicion score
    await this.adjustUserReputation(req, -0.1);
    
    // Store in Redis for security monitoring
    if (this.redis) {
      const key = `auth_limit_reached:${clientIP}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 3600); // 1 hour
    }
  }

  /**
   * Get user reputation score
   */
  getUserReputation(req) {
    const clientIP = this.getClientIP(req);
    const userKey = req.user?.id || clientIP;
    
    return this.adaptiveFactors.userReputation.get(userKey) || 0.5; // Default neutral reputation
  }

  /**
   * Adjust user reputation
   */
  async adjustUserReputation(req, adjustment) {
    const clientIP = this.getClientIP(req);
    const userKey = req.user?.id || clientIP;
    
    const currentReputation = this.getUserReputation(req);
    const newReputation = Math.max(0, Math.min(1, currentReputation + adjustment));
    
    this.adaptiveFactors.userReputation.set(userKey, newReputation);
    
    // Persist to Redis
    if (this.redis) {
      await this.redis.setex(`reputation:${userKey}`, 86400 * 30, newReputation); // 30 days
    }
  }

  /**
   * Get endpoint health score
   */
  getEndpointHealth(path) {
    return this.adaptiveFactors.endpointHealth.get(path) || 1.0; // Default healthy
  }

  /**
   * Update endpoint health
   */
  updateEndpointHealth(path, healthScore) {
    this.adaptiveFactors.endpointHealth.set(path, healthScore);
  }

  /**
   * Start adaptive monitoring
   */
  startAdaptiveMonitoring() {
    // Monitor system load every 30 seconds
    setInterval(async () => {
      await this.updateSystemMetrics();
    }, 30000);
    
    // Update user reputations every 5 minutes
    setInterval(async () => {
      await this.updateUserReputations();
    }, 300000);
    
    // Clean up old data every hour
    setInterval(async () => {
      await this.cleanupOldData();
    }, 3600000);
  }

  /**
   * Update system metrics for adaptive rate limiting
   */
  async updateSystemMetrics() {
    try {
      // Simulate system load calculation
      // In real implementation, this would check CPU, memory, response times, etc.
      const memoryUsage = process.memoryUsage();
      const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Simple load calculation based on memory usage
      this.adaptiveFactors.globalLoad = heapUsagePercent;
      
      // Store in Redis for monitoring
      if (this.redis) {
        await this.redis.setex('system:load', 60, this.adaptiveFactors.globalLoad);
      }
      
    } catch (error) {
      logger.error('Error updating system metrics:', error);
    }
  }

  /**
   * Update user reputations based on behavior
   */
  async updateUserReputations() {
    if (!this.redis) return;
    
    try {
      // Load reputations from Redis
      const keys = await this.redis.keys('reputation:*');
      
      for (const key of keys) {
        const reputation = await this.redis.get(key);
        if (reputation) {
          const userKey = key.replace('reputation:', '');
          this.adaptiveFactors.userReputation.set(userKey, parseFloat(reputation));
        }
      }
      
    } catch (error) {
      logger.error('Error updating user reputations:', error);
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    // Clean up in-memory reputation data older than 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [key, value] of this.adaptiveFactors.userReputation.entries()) {
      // In real implementation, you'd track timestamps
      // This is simplified for demonstration
      if (Math.random() < 0.1) { // Randomly clean up 10% of entries
        this.adaptiveFactors.userReputation.delete(key);
      }
    }
  }

  /**
   * Create middleware for different endpoint types
   */
  auth() {
    return this.createLimiter('auth');
  }

  api() {
    return this.createLimiter('api');
  }

  write() {
    return this.createLimiter('write');
  }

  upload() {
    return this.createLimiter('upload');
  }

  passwordReset() {
    return this.createLimiter('passwordReset');
  }

  public() {
    return this.createLimiter('public');
  }

  /**
   * Create custom rate limiter
   */
  custom(config) {
    return this.createLimiter('api', config);
  }

  /**
   * Get rate limiting statistics
   */
  async getStats() {
    if (!this.redis) return null;
    
    try {
      const stats = {
        globalLoad: this.adaptiveFactors.globalLoad,
        userReputations: this.adaptiveFactors.userReputation.size,
        endpointHealth: Object.fromEntries(this.adaptiveFactors.endpointHealth),
        limitReached: {}
      };
      
      // Get limit reached counts
      const limitKeys = await this.redis.keys('*limit_reached:*');
      for (const key of limitKeys) {
        const count = await this.redis.get(key);
        stats.limitReached[key] = parseInt(count) || 0;
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting rate limit stats:', error);
      return null;
    }
  }

  /**
   * Whitelist IP address
   */
  async whitelistIP(ip, duration = 86400) {
    if (!this.redis) return;
    
    try {
      await this.redis.setex(`whitelist:${ip}`, duration, '1');
      logger.info(`IP whitelisted: ${ip} for ${duration} seconds`);
    } catch (error) {
      logger.error('Error whitelisting IP:', error);
    }
  }

  /**
   * Check if IP is whitelisted
   */
  async isWhitelisted(ip) {
    if (!this.redis) return false;
    
    try {
      const whitelisted = await this.redis.get(`whitelist:${ip}`);
      return !!whitelisted;
    } catch (error) {
      logger.error('Error checking whitelist:', error);
      return false;
    }
  }
}

// Create singleton instance
const smartRateLimit = new SmartRateLimit();

module.exports = {
  SmartRateLimit,
  smartRateLimit,
  auth: () => smartRateLimit.auth(),
  api: () => smartRateLimit.api(),
  write: () => smartRateLimit.write(),
  upload: () => smartRateLimit.upload(),
  passwordReset: () => smartRateLimit.passwordReset(),
  public: () => smartRateLimit.public(),
  custom: (config) => smartRateLimit.custom(config),
  getStats: () => smartRateLimit.getStats(),
  whitelistIP: (ip, duration) => smartRateLimit.whitelistIP(ip, duration),
  isWhitelisted: (ip) => smartRateLimit.isWhitelisted(ip)
};