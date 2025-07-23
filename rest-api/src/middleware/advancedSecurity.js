import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { securityUtils } from '../utils/security.js';

// Advanced input sanitization middleware
export const advancedSanitization = (req, res, next) => {
  // Sanitize body, query, and params
  ['body', 'query', 'params'].forEach(key => {
    if (req[key]) {
      req[key] = sanitizeObject(req[key]);
    }
  });

  // Remove any keys that start with $ or contain dots (MongoDB operators)
  mongoSanitize()(req, res, next);
};

// Recursive sanitization function
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (key.startsWith('$') || key.includes('.') || key.includes('__proto__')) {
      continue;
    }
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

// Sanitize individual values
function sanitizeValue(value) {
  if (typeof value !== 'string') return value;

  // Remove null bytes
  value = value.replace(/\0/g, '');

  // Prevent SQL injection patterns
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_)/gi,
    /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/gi
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(value)) {
      // Log potential SQL injection attempt
      console.warn('Potential SQL injection attempt detected:', value);
      return value.replace(pattern, '');
    }
  }

  // HTML encode dangerous characters
  return securityUtils.sanitizeInput(value);
}

// Enhanced CORS configuration
export const advancedCors = () => {
  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    // Dynamic CORS based on environment
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
};

// Advanced security headers
export const advancedSecurityHeaders = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
        reportUri: '/api/security/csp-report',
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' }
  });
};

// Request size limiting
export const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: maxSize
      });
    }

    next();
  };
};

// Parse size string to bytes
function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const [, num, unit = 'b'] = match;
  return Math.floor(parseFloat(num) * units[unit]);
}

// Content type validation
export const contentTypeValidator = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (['GET', 'DELETE', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(415).json({
        error: 'Content-Type header is required'
      });
    }

    const baseContentType = contentType.split(';')[0].trim();
    if (!allowedTypes.includes(baseContentType)) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        allowed: allowedTypes
      });
    }

    next();
  };
};

// Advanced DDoS protection
export const ddosProtection = () => {
  const requestCounts = new Map();
  const blacklistedIPs = new Set();

  return async (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    // Check if IP is blacklisted
    if (blacklistedIPs.has(ip)) {
      await securityUtils.logSecurityEvent({
        type: 'ddos_blocked_ip',
        severity: 'warning',
        ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(429).json({
        error: 'Too many requests. IP temporarily blocked.'
      });
    }

    // Track request count
    const ipData = requestCounts.get(ip) || { count: 0, firstRequest: now, timestamps: [] };
    ipData.count++;
    ipData.timestamps.push(now);

    // Remove old timestamps (older than 1 minute)
    ipData.timestamps = ipData.timestamps.filter(ts => now - ts < 60000);

    // Check for DDoS patterns
    const requestsPerMinute = ipData.timestamps.length;
    const requestsPerSecond = ipData.timestamps.filter(ts => now - ts < 1000).length;

    if (requestsPerSecond > 10 || requestsPerMinute > 100) {
      // Blacklist IP temporarily
      blacklistedIPs.add(ip);
      setTimeout(() => blacklistedIPs.delete(ip), 300000); // 5 minutes

      await securityUtils.logSecurityEvent({
        type: 'ddos_detected',
        severity: 'critical',
        ip,
        userAgent: req.get('User-Agent'),
        details: {
          requestsPerSecond,
          requestsPerMinute
        }
      });

      await securityUtils.blacklistIP(ip, 'DDoS pattern detected', 1); // 1 hour

      return res.status(429).json({
        error: 'Rate limit exceeded. IP has been temporarily blocked.'
      });
    }

    requestCounts.set(ip, ipData);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, value] of requestCounts.entries()) {
        if (now - value.firstRequest > 300000) { // 5 minutes
          requestCounts.delete(key);
        }
      }
    }

    next();
  };
};

// Security monitoring endpoint
export const securityMonitoring = async (req, res, next) => {
  // Add security context to request
  req.securityContext = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    isSecure: req.secure,
    protocol: req.protocol
  };

  // Log high-risk operations
  const highRiskPaths = ['/api/auth/', '/api/users/', '/api/admin/'];
  const isHighRisk = highRiskPaths.some(path => req.path.startsWith(path));

  if (isHighRisk) {
    await securityUtils.logSecurityEvent({
      type: 'high_risk_operation',
      severity: 'info',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      details: {
        method: req.method,
        path: req.path
      }
    });
  }

  next();
};

// CSP violation report handler
export const cspReportHandler = async (req, res) => {
  const report = req.body;

  await securityUtils.logSecurityEvent({
    type: 'csp_violation',
    severity: 'warning',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: report
  });

  res.status(204).end();
};