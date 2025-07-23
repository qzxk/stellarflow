# Developer Onboarding Guide

Welcome to the Stellar API development team! This guide will help you get started with developing, testing, and contributing to the Stellar API.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Setup](#development-setup)
4. [API Architecture](#api-architecture)
5. [Development Workflow](#development-workflow)
6. [Testing](#testing)
7. [Code Style](#code-style)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

## Getting Started

### Prerequisites

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- MongoDB v6.0 or higher
- Git
- Docker (optional, for containerized development)
- Postman or similar API testing tool

### Quick Start

```bash
# Clone the repository
git clone https://github.com/stellar-team/stellar-api.git
cd stellar-api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start MongoDB (if not using Docker)
mongod --dbpath ./data

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`.

## Project Structure

```
stellar-api/
├── src/
│   ├── config/         # Configuration files
│   │   ├── config.js   # Main configuration
│   │   └── database.js # Database connection
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   │   ├── auth.js     # Authentication middleware
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── models/         # Mongoose models
│   │   └── User.js
│   ├── routes/         # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   └── health.js
│   ├── services/       # Business logic
│   │   ├── authService.js
│   │   └── emailService.js
│   ├── utils/          # Utility functions
│   │   ├── logger.js
│   │   └── validators.js
│   └── server.js       # Application entry point
├── tests/              # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/               # Documentation
├── scripts/            # Utility scripts
├── postman/            # Postman collections
└── examples/           # Code examples
```

## Development Setup

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
MONGODB_URI=mongodb://localhost:27017/stellar-api
MONGODB_URI_TEST=mongodb://localhost:27017/stellar-api-test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d
JWT_ALGORITHM=HS256
JWT_ISSUER=stellar-api
JWT_AUDIENCE=stellar-api-client

# Email Configuration (optional)
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-email-user
EMAIL_PASS=your-email-pass
EMAIL_FROM=noreply@stellar-api.com

# Security
BCRYPT_SALT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

# API Documentation
API_DOCS_ENABLED=true
API_DOCS_PATH=/api-docs

# CORS
CORS_ORIGIN=http://localhost:3001
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/app.log
```

### Docker Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/stellar-api
    depends_on:
      - mongo
    volumes:
      - ./src:/app/src
      - ./tests:/app/tests
    command: npm run dev

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

Start with Docker:
```bash
docker-compose up
```

## API Architecture

### Layered Architecture

The API follows a layered architecture pattern:

1. **Routes Layer**: Defines API endpoints and maps them to controllers
2. **Controller Layer**: Handles HTTP requests/responses
3. **Service Layer**: Contains business logic
4. **Model Layer**: Database models and schemas
5. **Middleware Layer**: Cross-cutting concerns (auth, validation, etc.)

### Request Flow

```
Client Request
    ↓
Routes (Define endpoints)
    ↓
Middleware (Auth, Validation, etc.)
    ↓
Controller (Handle request/response)
    ↓
Service (Business logic)
    ↓
Model (Database operations)
    ↓
Response to Client
```

### Example Implementation

**Route** (`routes/users.js`):
```javascript
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validation');

router.get('/profile', auth.authenticate, userController.getProfile);
router.put('/profile', auth.authenticate, validate.updateProfile, userController.updateProfile);

module.exports = router;
```

**Controller** (`controllers/userController.js`):
```javascript
const userService = require('../services/userService');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.userId);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.user.userId, req.body);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};
```

**Service** (`services/userService.js`):
```javascript
const User = require('../models/User');
const AppError = require('../utils/appError');

exports.getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

exports.updateUser = async (userId, updates) => {
  const user = await User.findByIdAndUpdate(
    userId,
    updates,
    { new: true, runValidators: true }
  );
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  return user;
};
```

## Development Workflow

### 1. Creating a New Feature

```bash
# Create a new feature branch
git checkout -b feature/user-preferences

# Make your changes
# ... edit files ...

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add user preferences endpoint"

# Push to remote
git push origin feature/user-preferences
```

### 2. Adding a New Endpoint

1. **Define the route** in `routes/`:
```javascript
// routes/preferences.js
router.get('/preferences', auth.authenticate, preferencesController.getPreferences);
router.put('/preferences', auth.authenticate, validate.preferences, preferencesController.updatePreferences);
```

2. **Create validation middleware** in `middleware/validation.js`:
```javascript
exports.preferences = [
  body('theme').optional().isIn(['light', 'dark']),
  body('language').optional().isIn(['en', 'es', 'fr']),
  body('notifications').optional().isBoolean(),
  handleValidationErrors
];
```

3. **Implement controller** in `controllers/`:
```javascript
// controllers/preferencesController.js
exports.getPreferences = async (req, res, next) => {
  try {
    const preferences = await preferencesService.getByUserId(req.user.userId);
    res.json({ success: true, preferences });
  } catch (error) {
    next(error);
  }
};
```

4. **Add service logic** in `services/`:
```javascript
// services/preferencesService.js
exports.getByUserId = async (userId) => {
  const user = await User.findById(userId).select('preferences');
  return user.preferences || defaultPreferences;
};
```

5. **Update Swagger documentation**:
```javascript
/**
 * @swagger
 * /api/v1/users/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences retrieved
 */
```

### 3. Database Migrations

Create a migration script:

```javascript
// scripts/migrations/add-user-preferences.js
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function up() {
  await User.updateMany(
    { preferences: { $exists: false } },
    { 
      $set: { 
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true
        }
      }
    }
  );
}

async function down() {
  await User.updateMany(
    {},
    { $unset: { preferences: 1 } }
  );
}

module.exports = { up, down };
```

## Testing

### Test Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for API endpoints
├── e2e/           # End-to-end tests
├── fixtures/      # Test data
└── helpers/       # Test utilities
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

**Unit Test Example**:
```javascript
// tests/unit/services/userService.test.js
const userService = require('../../../src/services/userService');
const User = require('../../../src/models/User');

jest.mock('../../../src/models/User');

describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { _id: '123', email: 'test@example.com' };
      User.findById.mockResolvedValue(mockUser);
      
      const result = await userService.getUserById('123');
      
      expect(result).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith('123');
    });
    
    it('should throw error when user not found', async () => {
      User.findById.mockResolvedValue(null);
      
      await expect(userService.getUserById('123'))
        .rejects.toThrow('User not found');
    });
  });
});
```

**Integration Test Example**:
```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });
  
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
      
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
    });
  });
});
```

### Test Database Setup

```javascript
// tests/helpers/testDb.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

exports.connect = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};

exports.closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
};

exports.clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
};
```

## Code Style

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'node/no-unpublished-require': ['error', {
      'allowModules': ['supertest', 'jest']
    }]
  }
};
```

### Coding Standards

1. **Naming Conventions**:
   - Files: `camelCase.js`
   - Classes/Constructors: `PascalCase`
   - Functions/Variables: `camelCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Database models: `PascalCase`

2. **Async/Await**: Always use async/await over callbacks
3. **Error Handling**: Always use try-catch blocks or .catch()
4. **Comments**: Use JSDoc for functions
5. **File Length**: Keep files under 300 lines

### Git Commit Messages

Follow conventional commits:

```
feat: add user preferences endpoint
fix: resolve login timeout issue
docs: update API documentation
test: add auth service tests
refactor: simplify user controller
perf: optimize database queries
chore: update dependencies
```

## Common Tasks

### Adding a New Model

```javascript
// models/Preference.js
const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  language: {
    type: String,
    enum: ['en', 'es', 'fr', 'de'],
    default: 'en'
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes
preferenceSchema.index({ userId: 1 });

// Methods
preferenceSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Preference', preferenceSchema);
```

### Creating Custom Middleware

```javascript
// middleware/requestLogger.js
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};
```

### Implementing Caching

```javascript
// utils/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes default

exports.get = (key) => cache.get(key);

exports.set = (key, value, ttl) => cache.set(key, value, ttl);

exports.del = (key) => cache.del(key);

exports.flush = () => cache.flushAll();

// Middleware for caching
exports.cacheMiddleware = (ttl = 600) => {
  return (req, res, next) => {
    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, data, ttl);
      originalJson.call(this, data);
    };
    
    next();
  };
};
```

### Error Handling

```javascript
// utils/appError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

// Usage
throw new AppError('User not found', 404);
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check if MongoDB is running
   ps aux | grep mongod
   
   # Start MongoDB manually
   mongod --dbpath ./data
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   
   # Kill the process
   kill -9 <PID>
   ```

3. **JWT Secret Missing**
   ```bash
   # Ensure .env file exists
   cp .env.example .env
   
   # Generate a secure secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Tests Failing**
   ```bash
   # Clear test database
   npm run test:clean
   
   # Run tests with verbose output
   npm test -- --verbose
   ```

### Debug Mode

Enable debug logging:

```bash
# Linux/Mac
DEBUG=app:* npm run dev

# Windows
set DEBUG=app:* && npm run dev
```

Add debug statements:

```javascript
const debug = require('debug')('app:auth');

debug('Processing login request for:', email);
```

### Performance Profiling

```javascript
// Add to server.js for development
if (process.env.NODE_ENV === 'development') {
  require('v8-profiler-node8');
  const profiler = require('v8-profiler-node8');
  const fs = require('fs');
  
  // Start profiling
  profiler.startProfiling('app', true);
  
  // Stop after 30 seconds
  setTimeout(() => {
    const profile = profiler.stopProfiling();
    profile.export((error, result) => {
      fs.writeFileSync('profile.cpuprofile', result);
      profile.delete();
    });
  }, 30000);
}
```

## Resources

### Internal Documentation

- [API Reference](./openapi.yaml) - OpenAPI specification
- [Authentication Guide](./AUTHENTICATION.md) - Auth implementation details
- [Database Schema](./DATABASE.md) - Model relationships
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment

### External Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT.io](https://jwt.io/) - JWT debugger
- [MongoDB University](https://university.mongodb.com/) - Free courses

### Tools

- [Postman](https://www.postman.com/) - API testing
- [MongoDB Compass](https://www.mongodb.com/products/compass) - Database GUI
- [VS Code REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) - API testing in VS Code
- [ngrok](https://ngrok.com/) - Expose local server

### Team Contacts

- **Tech Lead**: tech-lead@stellar-api.com
- **DevOps**: devops@stellar-api.com
- **Security**: security@stellar-api.com

### Support Channels

- Slack: #stellar-api-dev
- Wiki: https://wiki.stellar-api.com
- Issue Tracker: https://github.com/stellar-team/stellar-api/issues

## Next Steps

1. Set up your development environment
2. Run the test suite to ensure everything works
3. Review existing code and documentation
4. Pick a starter issue from the issue tracker
5. Join the team Slack channel
6. Attend the weekly dev sync meeting

Welcome aboard! 🚀