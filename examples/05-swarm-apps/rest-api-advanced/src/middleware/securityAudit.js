const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');
const useragent = require('useragent');

/**
 * Advanced Security Audit Middleware
 * Provides comprehensive security monitoring, threat detection, and vulnerability assessment
 */

class SecurityAudit {
  constructor() {
    this.suspiciousActivities = new Map();
    this.blockedIPs = new Set();
    this.securityEvents = [];
    this.redis = null;
    this.initializeRedis();
    
    // Security thresholds
    this.thresholds = {
      failedLoginAttempts: 5,
      requestRatePerMinute: 100,
      sqlInjectionPatterns: [
        /(\s|^)(union|select|insert|delete|update|drop|create|alter|exec|execute)\s/i,
        /(\s|^)(and|or)\s+\d+\s*=\s*\d+/i,
        /\b(script|javascript|vbscript)\b/i,
        /(<|%3C).*?(script|iframe|object|embed).*?(>|%3E)/i
      ],
      xssPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi
      ],
      pathTraversalPatterns: [
        /\.\.[\/\\]/g,
        /%2e%2e[\/\\]/gi,
        /\.\.[%252f|%255c]/gi
      ]
    };
  }

  async initializeRedis() {
    this.redis = getRedisClient();
    if (this.redis) {
      logger.info('Security audit connected to Redis for threat intelligence');
    }
  }

  /**
   * Main security audit middleware
   */
  audit() {
    return async (req, res, next) => {
      try {
        const clientIP = this.getClientIP(req);
        const userAgent = req.get('user-agent') || '';
        const requestSignature = this.generateRequestSignature(req);

        // Check if IP is blocked
        if (await this.isIPBlocked(clientIP)) {
          return this.handleBlockedRequest(req, res, 'IP_BLOCKED');
        }

        // Perform security checks
        const securityChecks = await Promise.all([
          this.checkSQLInjection(req),
          this.checkXSSAttempts(req),
          this.checkPathTraversal(req),
          this.checkSuspiciousUserAgent(userAgent),
          this.checkRequestRate(clientIP),
          this.checkRequestSize(req),
          this.checkSuspiciousHeaders(req),
          this.checkBotDetection(req, userAgent)
        ]);

        // Analyze results
        const threats = securityChecks.filter(check => check.threat);
        
        if (threats.length > 0) {
          await this.handleSecurityThreat(req, res, threats, clientIP);
          return;
        }

        // Log successful security check
        await this.logSecurityEvent(req, {
          type: 'SECURITY_CHECK_PASSED',
          clientIP,
          userAgent,
          timestamp: new Date().toISOString()
        });

        next();
      } catch (error) {
        logger.error('Security audit error:', error);
        next(); // Continue processing even if security check fails
      }
    };
  }

  /**
   * Get client IP address considering proxies
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
   * Generate unique request signature for anomaly detection
   */
  generateRequestSignature(req) {
    const data = `${req.method}-${req.originalUrl}-${req.get('user-agent')}-${this.getClientIP(req)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check for SQL injection attempts
   */
  async checkSQLInjection(req) {
    const checkContent = (content) => {
      if (!content) return false;
      const contentStr = typeof content === 'object' ? JSON.stringify(content) : String(content);
      return this.thresholds.sqlInjectionPatterns.some(pattern => pattern.test(contentStr));
    };

    const sqlInjectionFound = 
      checkContent(req.query) ||
      checkContent(req.body) ||
      checkContent(req.params);

    if (sqlInjectionFound) {
      return {
        threat: true,
        type: 'SQL_INJECTION',
        severity: 'HIGH',
        details: 'Potential SQL injection patterns detected'
      };
    }

    return { threat: false };
  }

  /**
   * Check for XSS attempts
   */
  async checkXSSAttempts(req) {
    const checkContent = (content) => {
      if (!content) return false;
      const contentStr = typeof content === 'object' ? JSON.stringify(content) : String(content);
      return this.thresholds.xssPatterns.some(pattern => pattern.test(contentStr));
    };

    const xssFound = 
      checkContent(req.query) ||
      checkContent(req.body) ||
      checkContent(req.headers);

    if (xssFound) {
      return {
        threat: true,
        type: 'XSS_ATTEMPT',
        severity: 'HIGH',
        details: 'Potential XSS patterns detected'
      };
    }

    return { threat: false };
  }

  /**
   * Check for path traversal attempts
   */
  async checkPathTraversal(req) {
    const url = req.originalUrl || req.url;
    const pathTraversalFound = this.thresholds.pathTraversalPatterns.some(pattern => 
      pattern.test(url)
    );

    if (pathTraversalFound) {
      return {
        threat: true,
        type: 'PATH_TRAVERSAL',
        severity: 'HIGH',
        details: 'Path traversal attempt detected'
      };
    }

    return { threat: false };
  }

  /**
   * Check for suspicious user agents
   */
  async checkSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /openvas/i,
      /masscan/i,
      /nmap/i,
      /curl.*bot/i,
      /wget.*bot/i
    ];

    const suspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

    if (suspicious) {
      return {
        threat: true,
        type: 'SUSPICIOUS_USER_AGENT',
        severity: 'MEDIUM',
        details: `Suspicious user agent detected: ${userAgent}`
      };
    }

    return { threat: false };
  }

  /**
   * Check request rate for potential DDoS
   */
  async checkRequestRate(clientIP) {
    if (!this.redis) return { threat: false };

    try {
      const key = `rate_limit:${clientIP}`;
      const requests = await this.redis.incr(key);
      
      if (requests === 1) {
        await this.redis.expire(key, 60); // 1 minute window
      }

      if (requests > this.thresholds.requestRatePerMinute) {
        return {
          threat: true,
          type: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          details: `Request rate exceeded: ${requests} requests per minute`
        };
      }

      return { threat: false };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return { threat: false };
    }
  }

  /**
   * Check request size for potential attacks
   */
  async checkRequestSize(req) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get('content-length') || '0');

    if (contentLength > maxSize) {
      return {
        threat: true,
        type: 'OVERSIZED_REQUEST',
        severity: 'MEDIUM',
        details: `Request size too large: ${contentLength} bytes`
      };
    }

    return { threat: false };
  }

  /**
   * Check for suspicious headers
   */
  async checkSuspiciousHeaders(req) {
    const suspiciousHeaders = [
      'x-originating-ip',
      'x-forwarded-host',
      'x-remote-ip'
    ];

    const foundSuspicious = suspiciousHeaders.some(header => 
      req.get(header) && req.get(header) !== req.get('x-forwarded-for')
    );

    if (foundSuspicious) {
      return {
        threat: true,
        type: 'SUSPICIOUS_HEADERS',
        severity: 'MEDIUM',
        details: 'Suspicious header manipulation detected'
      };
    }

    return { threat: false };
  }

  /**
   * Bot detection
   */
  async checkBotDetection(req, userAgent) {
    const agent = useragent.parse(userAgent);
    
    // Check for common bot patterns
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /facebook|twitter|linkedin|pinterest/i,
      /google|bing|yahoo|duckduckgo/i
    ];

    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    
    // Check for headless browsers
    const headlessPatterns = [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /chromedriver/i
    ];

    const isHeadless = headlessPatterns.some(pattern => pattern.test(userAgent));

    if (isHeadless) {
      return {
        threat: true,
        type: 'HEADLESS_BROWSER',
        severity: 'MEDIUM',
        details: 'Headless browser detected'
      };
    }

    // Log legitimate bots for analytics
    if (isBot) {
      await this.logSecurityEvent(req, {
        type: 'BOT_DETECTED',
        userAgent,
        legitimate: true
      });
    }

    return { threat: false };
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip) {
    if (this.blockedIPs.has(ip)) return true;

    if (this.redis) {
      try {
        const blocked = await this.redis.get(`blocked_ip:${ip}`);
        return !!blocked;
      } catch (error) {
        logger.error('IP block check error:', error);
      }
    }

    return false;
  }

  /**
   * Handle security threats
   */
  async handleSecurityThreat(req, res, threats, clientIP) {
    const highSeverityThreats = threats.filter(t => t.severity === 'HIGH');
    
    // Block IP for high severity threats
    if (highSeverityThreats.length > 0) {
      await this.blockIP(clientIP, 3600); // Block for 1 hour
    }

    // Log all threats
    for (const threat of threats) {
      await this.logSecurityEvent(req, {
        type: 'SECURITY_THREAT_DETECTED',
        threat,
        clientIP,
        userAgent: req.get('user-agent'),
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }

    // Send appropriate response
    const response = {
      error: 'Security violation detected',
      code: 'SECURITY_VIOLATION',
      timestamp: new Date().toISOString(),
      requestId: req.id
    };

    res.status(403).json(response);
  }

  /**
   * Handle blocked requests
   */
  handleBlockedRequest(req, res, reason) {
    const response = {
      error: 'Access denied',
      code: reason,
      timestamp: new Date().toISOString(),
      requestId: req.id
    };

    res.status(429).json(response);
  }

  /**
   * Block IP address
   */
  async blockIP(ip, duration = 3600) {
    this.blockedIPs.add(ip);
    
    if (this.redis) {
      try {
        await this.redis.setex(`blocked_ip:${ip}`, duration, 'blocked');
        logger.warn(`IP blocked: ${ip} for ${duration} seconds`);
      } catch (error) {
        logger.error('IP blocking error:', error);
      }
    }

    // Remove from memory after duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, duration * 1000);
  }

  /**
   * Log security events
   */
  async logSecurityEvent(req, event) {
    const securityEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      requestId: req.id,
      ip: this.getClientIP(req),
      url: req.originalUrl,
      method: req.method
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events in memory
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Store in Redis for persistence
    if (this.redis) {
      try {
        const key = `security_events:${new Date().toISOString().split('T')[0]}`;
        await this.redis.lpush(key, JSON.stringify(securityEvent));
        await this.redis.expire(key, 86400 * 30); // 30 days retention
      } catch (error) {
        logger.error('Security event logging error:', error);
      }
    }

    // Log to application logger
    if (event.type === 'SECURITY_THREAT_DETECTED') {
      logger.warn('Security threat detected', securityEvent);
    } else {
      logger.info('Security event', securityEvent);
    }
  }

  /**
   * Get security summary
   */
  async getSecuritySummary() {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentEvents = this.securityEvents.filter(event => 
      new Date(event.timestamp).getTime() > last24Hours
    );

    const threatTypes = {};
    recentEvents.forEach(event => {
      if (event.threat) {
        threatTypes[event.threat.type] = (threatTypes[event.threat.type] || 0) + 1;
      }
    });

    return {
      totalEvents: recentEvents.length,
      threatTypes,
      blockedIPs: Array.from(this.blockedIPs),
      topThreats: Object.entries(threatTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(days = 7) {
    const report = {
      reportPeriod: `${days} days`,
      generatedAt: new Date().toISOString(),
      summary: await this.getSecuritySummary(),
      recommendations: []
    };

    // Analyze threats and generate recommendations
    const threatCounts = report.summary.threatTypes;
    
    if (threatCounts.SQL_INJECTION > 0) {
      report.recommendations.push({
        priority: 'HIGH',
        issue: 'SQL injection attempts detected',
        recommendation: 'Review input validation and use parameterized queries'
      });
    }

    if (threatCounts.XSS_ATTEMPT > 0) {
      report.recommendations.push({
        priority: 'HIGH',
        issue: 'XSS attempts detected',
        recommendation: 'Implement output encoding and Content Security Policy'
      });
    }

    if (threatCounts.RATE_LIMIT_EXCEEDED > 10) {
      report.recommendations.push({
        priority: 'MEDIUM',
        issue: 'High rate limiting violations',
        recommendation: 'Consider implementing more aggressive rate limiting or CAPTCHA'
      });
    }

    return report;
  }

  /**
   * Vulnerability assessment
   */
  async performVulnerabilityAssessment() {
    const vulnerabilities = [];

    // Check for common security misconfigurations
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      vulnerabilities.push({
        type: 'WEAK_JWT_SECRET',
        severity: 'HIGH',
        description: 'JWT secret is too weak or not set'
      });
    }

    if (process.env.NODE_ENV !== 'production' && 
        (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('localhost'))) {
      vulnerabilities.push({
        type: 'DEVELOPMENT_DATABASE_IN_PRODUCTION',
        severity: 'MEDIUM',
        description: 'Using development database configuration'
      });
    }

    return {
      vulnerabilities,
      assessmentDate: new Date().toISOString(),
      overallRisk: this.calculateRiskScore(vulnerabilities)
    };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(vulnerabilities) {
    let score = 0;
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'HIGH': score += 10; break;
        case 'MEDIUM': score += 5; break;
        case 'LOW': score += 1; break;
      }
    });

    if (score >= 20) return 'CRITICAL';
    if (score >= 10) return 'HIGH';
    if (score >= 5) return 'MEDIUM';
    return 'LOW';
  }
}

// Create singleton instance
const securityAudit = new SecurityAudit();

module.exports = {
  SecurityAudit,
  securityAudit,
  audit: () => securityAudit.audit(),
  getSecuritySummary: () => securityAudit.getSecuritySummary(),
  generateSecurityReport: (days) => securityAudit.generateSecurityReport(days),
  performVulnerabilityAssessment: () => securityAudit.performVulnerabilityAssessment()
};