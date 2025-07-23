import rateLimit from 'express-rate-limit';
import { Database } from '../config/database.js';

// Store for tracking login attempts
const loginAttempts = new Map();

// Generic rate limiter factory
export const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip
  } = options;

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator
  });
};

// Auth-specific rate limiters
export const authLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
});

// Registration rate limiter
export const registerLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 registrations per hour per IP
  message: 'Too many registration attempts, please try again later.'
});

// Password reset rate limiter
export const passwordResetLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password resets per hour
  message: 'Too many password reset attempts, please try again later.'
});

// General API rate limiter
export const apiLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'API rate limit exceeded, please try again later.'
});

// Account lockout system
export const accountLockout = {
  // Track failed login attempts
  trackFailedAttempt: async (identifier) => {
    const key = `failed_${identifier}`;
    const attempts = loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    
    loginAttempts.set(key, attempts);
    
    // Store in database for persistence
    try {
      await Database.run(
        `INSERT OR REPLACE INTO login_attempts (identifier, attempts, first_attempt, last_attempt)
         VALUES (?, ?, ?, ?)`,
        [identifier, attempts.count, new Date(attempts.firstAttempt).toISOString(), new Date(attempts.lastAttempt).toISOString()]
      );
    } catch (error) {
      console.error('Failed to store login attempt:', error);
    }
    
    return attempts;
  },
  
  // Check if account is locked
  isAccountLocked: async (identifier) => {
    const key = `failed_${identifier}`;
    let attempts = loginAttempts.get(key);
    
    // If not in memory, check database
    if (!attempts) {
      try {
        const dbAttempts = await Database.get(
          'SELECT * FROM login_attempts WHERE identifier = ?',
          [identifier]
        );
        
        if (dbAttempts) {
          attempts = {
            count: dbAttempts.attempts,
            firstAttempt: new Date(dbAttempts.first_attempt).getTime(),
            lastAttempt: new Date(dbAttempts.last_attempt).getTime()
          };
          loginAttempts.set(key, attempts);
        }
      } catch (error) {
        console.error('Failed to check login attempts:', error);
        return { locked: false };
      }
    }
    
    if (!attempts) {
      return { locked: false };
    }
    
    const maxAttempts = 5;
    const lockoutWindow = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    
    // Reset attempts if lockout window has passed
    if (now - attempts.firstAttempt > lockoutWindow) {
      loginAttempts.delete(key);
      try {
        await Database.run('DELETE FROM login_attempts WHERE identifier = ?', [identifier]);
      } catch (error) {
        console.error('Failed to clean login attempts:', error);
      }
      return { locked: false };
    }
    
    // Check if account is locked
    if (attempts.count >= maxAttempts) {
      const timeRemaining = lockoutWindow - (now - attempts.firstAttempt);
      return {
        locked: true,
        timeRemaining: Math.ceil(timeRemaining / 1000 / 60), // minutes
        attempts: attempts.count
      };
    }
    
    return {
      locked: false,
      attempts: attempts.count,
      remaining: maxAttempts - attempts.count
    };
  },
  
  // Clear failed attempts on successful login
  clearFailedAttempts: async (identifier) => {
    const key = `failed_${identifier}`;
    loginAttempts.delete(key);
    
    try {
      await Database.run('DELETE FROM login_attempts WHERE identifier = ?', [identifier]);
    } catch (error) {
      console.error('Failed to clear login attempts:', error);
    }
  }
};

// Middleware to check account lockout
export const checkAccountLockout = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.body.username;
    
    if (!identifier) {
      return next();
    }
    
    const lockStatus = await accountLockout.isAccountLocked(identifier);
    
    if (lockStatus.locked) {
      return res.status(423).json({
        error: 'Account temporarily locked due to too many failed login attempts',
        timeRemaining: lockStatus.timeRemaining,
        attempts: lockStatus.attempts
      });
    }
    
    // Add lockout info to request for use in auth routes
    req.lockoutInfo = lockStatus;
    next();
  } catch (error) {
    console.error('Account lockout check failed:', error);
    next(); // Don't block on error
  }
};

// Clean up expired login attempts (run periodically)
export const cleanupExpiredAttempts = async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    await Database.run(
      'DELETE FROM login_attempts WHERE first_attempt < ?',
      [cutoff.toISOString()]
    );
    
    // Clean up memory store
    for (const [key, attempts] of loginAttempts.entries()) {
      if (Date.now() - attempts.firstAttempt > 30 * 60 * 1000) {
        loginAttempts.delete(key);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup expired attempts:', error);
  }
};

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Enforce HTTPS (in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'"
  );
  
  next();
};

// IP-based suspicious activity detection
export const suspiciousActivityDetector = (req, res, next) => {
  const ip = req.ip;
  const userAgent = req.get('User-Agent');
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /scanner/i,
    /hack/i,
    /attack/i
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent || '')
  );
  
  if (isSuspicious) {
    console.warn(`Suspicious activity detected from IP: ${ip}, User-Agent: ${userAgent}`);
    // Could implement additional logging or blocking here
  }
  
  next();
};

// Initialize login attempts table
export const initializeLoginAttemptsTable = async () => {
  try {
    await Database.run(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier VARCHAR(255) NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        first_attempt DATETIME NOT NULL,
        last_attempt DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(identifier)
      )
    `);
    
    await Database.run('CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier)');
    await Database.run('CREATE INDEX IF NOT EXISTS idx_login_attempts_first_attempt ON login_attempts(first_attempt)');
    
    console.log('Login attempts table initialized');
  } catch (error) {
    console.error('Failed to initialize login attempts table:', error);
  }
};

// Start cleanup interval
setInterval(cleanupExpiredAttempts, 10 * 60 * 1000); // Clean up every 10 minutes
