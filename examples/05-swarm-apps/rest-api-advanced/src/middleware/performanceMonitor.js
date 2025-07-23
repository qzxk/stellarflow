const os = require('os');
const cluster = require('cluster');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Performance Monitoring Middleware
 * Tracks API response times, memory usage, and system metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errors: 0,
      slowQueries: 0,
      activeConnections: 0,
      memoryUsage: {},
      systemHealth: {}
    };
    
    this.slowQueryThreshold = 1000; // 1 second
    this.redis = null;
    this.startTime = Date.now();
    
    // Initialize Redis connection for metrics storage
    this.initializeRedis();
    
    // Start periodic system monitoring
    this.startSystemMonitoring();
  }

  async initializeRedis() {
    this.redis = getRedisClient();
    if (this.redis) {
      logger.info('Performance monitor connected to Redis');
    }
  }

  /**
   * Main middleware function for request monitoring
   */
  monitor() {
    return (req, res, next) => {
      const startTime = Date.now();
      req.startTime = startTime;
      req.requestId = req.id || this.generateRequestId();

      // Track active connections
      this.metrics.activeConnections++;

      // Monitor memory usage per request
      const initialMemory = process.memoryUsage();

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Update metrics
        this.updateMetrics(req, res, responseTime, initialMemory);
        
        // Log performance data
        this.logPerformanceData(req, res, responseTime);
        
        // Store metrics in Redis if available
        this.storeMetrics(req, res, responseTime);
        
        // Call original end method
        originalEnd.apply(res, args);
        
        // Decrease active connections
        this.metrics.activeConnections--;
      };

      next();
    };
  }

  /**
   * Update internal metrics
   */
  updateMetrics(req, res, responseTime, initialMemory) {
    this.metrics.requests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requests;

    // Track errors
    if (res.statusCode >= 400) {
      this.metrics.errors++;
    }

    // Track slow queries
    if (responseTime > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
      logger.warn(`Slow query detected: ${req.method} ${req.originalUrl} - ${responseTime}ms`, {
        requestId: req.requestId,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Update memory metrics
    const currentMemory = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: currentMemory.heapUsed,
      heapTotal: currentMemory.heapTotal,
      external: currentMemory.external,
      rss: currentMemory.rss,
      memoryDelta: currentMemory.heapUsed - initialMemory.heapUsed
    };
  }

  /**
   * Log detailed performance data
   */
  logPerformanceData(req, res, responseTime) {
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString()
    };

    if (responseTime > this.slowQueryThreshold) {
      logger.warn('Slow request detected', logData);
    } else {
      logger.info('Request completed', logData);
    }
  }

  /**
   * Store metrics in Redis for historical analysis
   */
  async storeMetrics(req, res, responseTime) {
    if (!this.redis) return;

    try {
      const metricsKey = `metrics:${new Date().toISOString().split('T')[0]}`;
      const hourKey = `metrics:hourly:${new Date().toISOString().substring(0, 13)}`;
      
      const metricData = {
        timestamp: Date.now(),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        memoryUsage: this.metrics.memoryUsage.heapUsed,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };

      // Store daily metrics
      await this.redis.lpush(metricsKey, JSON.stringify(metricData));
      await this.redis.expire(metricsKey, 86400 * 30); // 30 days retention

      // Store hourly aggregated metrics
      await this.redis.hincrby(hourKey, 'requests', 1);
      await this.redis.hincrby(hourKey, 'totalResponseTime', responseTime);
      await this.redis.hincrby(hourKey, res.statusCode >= 400 ? 'errors' : 'success', 1);
      await this.redis.expire(hourKey, 86400 * 7); // 7 days retention

    } catch (error) {
      logger.error('Failed to store metrics in Redis:', error);
    }
  }

  /**
   * Start periodic system monitoring
   */
  startSystemMonitoring() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect system-level metrics
   */
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.systemHealth = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        systemTotal: Math.round(os.totalmem() / 1024 / 1024), // MB
        systemFree: Math.round(os.freemem() / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      eventLoop: {
        delay: this.getEventLoopDelay()
      }
    };

    // Log system metrics if memory usage is high
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      logger.warn('High memory usage detected', {
        memoryUsagePercent: `${memoryUsagePercent.toFixed(2)}%`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      });
    }
  }

  /**
   * Measure event loop delay
   */
  getEventLoopDelay() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      return delay;
    });
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    const uptime = Date.now() - this.startTime;
    return {
      ...this.metrics,
      uptime: Math.round(uptime / 1000), // seconds
      requestsPerSecond: this.metrics.requests / (uptime / 1000),
      errorRate: (this.metrics.errors / this.metrics.requests) * 100,
      slowQueryRate: (this.metrics.slowQueries / this.metrics.requests) * 100
    };
  }

  /**
   * Get historical metrics from Redis
   */
  async getHistoricalMetrics(days = 7) {
    if (!this.redis) return null;

    try {
      const metrics = [];
      const now = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = `metrics:${date.toISOString().split('T')[0]}`;
        const dayMetrics = await this.redis.lrange(key, 0, -1);
        
        metrics.push({
          date: date.toISOString().split('T')[0],
          requests: dayMetrics.length,
          data: dayMetrics.map(m => JSON.parse(m))
        });
      }
      
      return metrics;
    } catch (error) {
      logger.error('Failed to retrieve historical metrics:', error);
      return null;
    }
  }

  /**
   * Performance analysis and recommendations
   */
  async analyzePerformance() {
    const metrics = this.getMetricsSummary();
    const recommendations = [];

    // Analyze response times
    if (metrics.averageResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: 'High average response time',
        recommendation: 'Consider implementing caching, database query optimization, or horizontal scaling'
      });
    }

    // Analyze error rates
    if (metrics.errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        issue: 'High error rate',
        recommendation: 'Review error logs and implement better error handling and validation'
      });
    }

    // Analyze slow queries
    if (metrics.slowQueryRate > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        issue: 'High slow query rate',
        recommendation: 'Optimize database queries, add indexes, or implement query caching'
      });
    }

    // Analyze memory usage
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push({
        type: 'resource',
        priority: 'high',
        issue: 'High memory usage',
        recommendation: 'Implement memory optimization, check for memory leaks, or increase available memory'
      });
    }

    return {
      metrics,
      recommendations,
      analysis: {
        overallHealth: this.calculateHealthScore(metrics),
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate overall health score
   */
  calculateHealthScore(metrics) {
    let score = 100;
    
    // Deduct points for high response times
    if (metrics.averageResponseTime > 1000) score -= 20;
    else if (metrics.averageResponseTime > 500) score -= 10;
    
    // Deduct points for high error rates
    if (metrics.errorRate > 10) score -= 30;
    else if (metrics.errorRate > 5) score -= 15;
    
    // Deduct points for slow queries
    if (metrics.slowQueryRate > 20) score -= 20;
    else if (metrics.slowQueryRate > 10) score -= 10;
    
    // Deduct points for high memory usage
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) score -= 20;
    else if (memoryUsagePercent > 80) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errors: 0,
      slowQueries: 0,
      activeConnections: 0,
      memoryUsage: {},
      systemHealth: {}
    };
    this.startTime = Date.now();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor,
  monitor: () => performanceMonitor.monitor(),
  getMetrics: () => performanceMonitor.getMetricsSummary(),
  getHistoricalMetrics: (days) => performanceMonitor.getHistoricalMetrics(days),
  analyzePerformance: () => performanceMonitor.analyzePerformance()
};