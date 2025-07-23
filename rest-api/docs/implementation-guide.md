# REST API Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the REST API based on the architecture design.

## Project Structure
```
rest-api/
├── docs/                    # Documentation
│   ├── architecture.md      # System architecture
│   ├── api-specification.md # API endpoints spec
│   ├── database-schema.md   # Database design
│   └── implementation-guide.md
├── src/
│   ├── config/             # Configuration files
│   │   ├── database.js     # Database connection
│   │   ├── redis.js        # Redis connection
│   │   ├── logger.js       # Winston logger setup
│   │   └── constants.js    # App constants
│   ├── controllers/        # Request handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── product.controller.js
│   │   └── review.controller.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.js         # JWT authentication
│   │   ├── authorize.js    # Role-based authorization
│   │   ├── validate.js     # Request validation
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── errorHandler.js # Global error handler
│   │   └── logger.js       # Request/response logging
│   ├── models/             # Database models
│   │   ├── user.model.js
│   │   ├── product.model.js
│   │   ├── review.model.js
│   │   └── index.js
│   ├── routes/             # API routes
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── product.routes.js
│   │   ├── review.routes.js
│   │   └── index.js
│   ├── services/           # Business logic
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── product.service.js
│   │   ├── email.service.js
│   │   └── cache.service.js
│   ├── utils/              # Utility functions
│   │   ├── errors.js       # Custom error classes
│   │   ├── validators.js   # Validation schemas
│   │   ├── helpers.js      # Helper functions
│   │   └── constants.js    # Constants
│   ├── app.js              # Express app setup
│   └── server.js           # Server entry point
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # End-to-end tests
├── migrations/             # Database migrations
├── scripts/                # Utility scripts
├── .env.example            # Environment variables template
├── .gitignore
├── package.json
├── README.md
└── docker-compose.yml      # Local development setup
```

## Implementation Steps

### Phase 1: Project Setup

#### 1.1 Initialize Project
```bash
# Create project directory
mkdir rest-api && cd rest-api

# Initialize npm project
npm init -y

# Install core dependencies
npm install express cors helmet compression body-parser dotenv
npm install jsonwebtoken bcrypt uuid
npm install winston morgan
npm install redis ioredis
npm install pg pg-pool
npm install joi express-validator
npm install express-rate-limit

# Install dev dependencies
npm install -D nodemon jest supertest
npm install -D @types/node @types/express
npm install -D eslint prettier eslint-config-prettier
npm install -D husky lint-staged
```

#### 1.2 Environment Configuration
Create `.env.example`:
```env
# Server
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rest_api_db
DB_USER=api_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Phase 2: Core Infrastructure

#### 2.1 Database Connection
```javascript
// src/config/database.js
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
```

#### 2.2 Redis Connection
```javascript
// src/config/redis.js
const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

module.exports = redis;
```

#### 2.3 Logger Setup
```javascript
// src/config/logger.js
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rest-api' },
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = logger;
```

### Phase 3: Middleware Implementation

#### 3.1 Authentication Middleware
```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

module.exports = { authenticate };
```

#### 3.2 Authorization Middleware
```javascript
// src/middleware/authorize.js
const { AuthorizationError } = require('../utils/errors');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }

    const hasRole = req.user.roles.some(role => 
      allowedRoles.includes(role)
    );

    if (!hasRole) {
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

const checkOwnership = (resourceGetter) => {
  return async (req, res, next) => {
    try {
      const resource = await resourceGetter(req);
      
      if (!resource) {
        return next(new NotFoundError('Resource not found'));
      }

      if (resource.userId !== req.user.id && 
          !req.user.roles.includes('admin')) {
        return next(new AuthorizationError('Access denied'));
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { authorize, checkOwnership };
```

### Phase 4: Service Layer

#### 4.1 Authentication Service
```javascript
// src/services/auth.service.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const redis = require('../config/redis');
const { ValidationError, AuthenticationError } = require('../utils/errors');

class AuthService {
  async register(userData) {
    const { email, password, firstName, lastName } = userData;
    
    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      throw new ValidationError([{
        field: 'email',
        message: 'Email already registered'
      }]);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await db.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, created_at
    `, [uuidv4(), email, passwordHash, firstName, lastName]);
    
    const user = result.rows[0];
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    
    return { user, tokens };
  }

  async login(email, password) {
    // Get user
    const result = await db.query(`
      SELECT id, email, password_hash, first_name, last_name, roles
      FROM users
      WHERE email = $1 AND deleted_at IS NULL
    `, [email]);
    
    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Generate tokens
    const tokens = this.generateTokens(user);
    
    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    
    delete user.password_hash;
    return { user, tokens };
  }

  generateTokens(user) {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles || ['user']
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY }
    );
    
    return { accessToken, refreshToken };
  }

  async storeRefreshToken(userId, token) {
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `, [userId, tokenHash, expiresAt]);
  }
}

module.exports = new AuthService();
```

### Phase 5: Controller Implementation

#### 5.1 Authentication Controller
```javascript
// src/controllers/auth.controller.js
const authService = require('../services/auth.service');
const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

class AuthController {
  async register(req, res, next) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array());
      }
      
      const { user, tokens } = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        data: {
          user,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 900 // 15 minutes
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array());
      }
      
      const { email, password } = req.body;
      const { user, tokens } = await authService.login(email, password);
      
      res.json({
        success: true,
        data: {
          user,
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: 900
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(refreshToken);
      
      res.json({
        success: true,
        data: { tokens }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id, req.body.refreshToken);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
```

### Phase 6: Route Setup

#### 6.1 Authentication Routes
```javascript
// src/routes/auth.routes.js
const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/refresh', body('refreshToken').notEmpty(), authController.refresh);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
```

### Phase 7: App Configuration

#### 7.1 Express App Setup
```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./config/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1', routes);

// Error handling
app.use(errorHandler);

module.exports = app;
```

#### 7.2 Server Entry Point
```javascript
// src/server.js
require('dotenv').config();

const app = require('./app');
const logger = require('./config/logger');
const db = require('./config/database');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Database connected successfully');
    
    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.pool.end();
  redis.disconnect();
  process.exit(0);
});
```

## Testing Strategy

### Unit Test Example
```javascript
// tests/unit/services/auth.service.test.js
const authService = require('../../../src/services/auth.service');
const db = require('../../../src/config/database');
const bcrypt = require('bcrypt');

jest.mock('../../../src/config/database');
jest.mock('bcrypt');

describe('AuthService', () => {
  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No existing user
      db.query.mockResolvedValueOnce({ 
        rows: [{ id: 'user-id', email: 'test@example.com' }] 
      });
      bcrypt.hash.mockResolvedValue('hashed-password');
      
      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      });
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });
  });
});
```

### Integration Test Example
```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User'
        });
        
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
    });
  });
});
```

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Performance testing done
- [ ] Documentation updated
- [ ] Environment variables configured
- [ ] SSL certificates ready

### Database
- [ ] Migrations tested
- [ ] Backup strategy implemented
- [ ] Connection pooling configured
- [ ] Indexes optimized

### Infrastructure
- [ ] Load balancer configured
- [ ] Auto-scaling rules set
- [ ] Monitoring alerts configured
- [ ] Logging aggregation setup

### Post-deployment
- [ ] Smoke tests passed
- [ ] Performance metrics baseline
- [ ] Team notification sent
- [ ] Rollback plan ready

## Next Steps

1. **Complete Service Layer**: Implement remaining services (Product, User, Review)
2. **Add Validation**: Create comprehensive validation schemas
3. **Implement Caching**: Add Redis caching for frequently accessed data
4. **Setup Testing**: Write comprehensive test suites
5. **Add Documentation**: Generate API documentation with Swagger
6. **Security Hardening**: Implement additional security measures
7. **Performance Optimization**: Profile and optimize critical paths
8. **Monitoring Setup**: Configure APM and logging aggregation

This implementation guide provides a solid foundation for building the REST API. Follow the phases sequentially and ensure each component is thoroughly tested before moving to the next.