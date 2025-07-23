/**
 * Test Helper Utilities
 * Common utilities and helpers for all test suites
 */

const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { testData } = require('../fixtures/test-data');
const config = require('../config/test-config').getConfig();

class TestHelpers {
  constructor() {
    this.tempDirs = [];
    this.createdUsers = [];
    this.authTokens = new Map();
  }

  // === Authentication Helpers ===

  /**
   * Generate JWT token for testing
   */
  generateToken(payload, secret = config.auth.jwtSecret, expiresIn = config.auth.jwtExpire) {
    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * Create test user and return with auth token
   */
  async createTestUser(userData = {}, app = null) {
    const defaultUser = {
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'user',
      ...userData
    };

    let user;
    if (app) {
      // Create via API
      const response = await request(app)
        .post('/api/auth/register')
        .send(defaultUser);
      
      user = response.body.data.user;
      const token = response.body.data.token;
      
      this.createdUsers.push(user.id);
      this.authTokens.set(user.id, token);
      
      return { user, token };
    } else {
      // Create directly in database
      const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
      const hashedPassword = await bcrypt.hash(defaultUser.password, config.auth.bcryptRounds);
      
      user = await User.create({
        ...defaultUser,
        password: hashedPassword
      });

      const token = this.generateToken({
        userId: user._id,
        email: user.email,
        role: user.role
      });

      this.createdUsers.push(user._id);
      this.authTokens.set(user._id, token);

      return { user, token };
    }
  }

  /**
   * Login user and return token
   */
  async loginUser(credentials, app) {
    const response = await request(app)
      .post('/api/auth/login')
      .send(credentials);

    if (response.status === 200) {
      const { user, token } = response.body.data;
      this.authTokens.set(user.id, token);
      return { user, token };
    }

    throw new Error(`Login failed: ${response.body.error}`);
  }

  /**
   * Get authorization header for user
   */
  getAuthHeader(userId) {
    const token = this.authTokens.get(userId);
    return token ? `Bearer ${token}` : null;
  }

  // === Database Helpers ===

  /**
   * Clear specific collections
   */
  async clearCollections(collections = []) {
    for (const collection of collections) {
      if (mongoose.connection.collections[collection]) {
        await mongoose.connection.collections[collection].deleteMany({});
      }
    }
  }

  /**
   * Seed database with test data
   */
  async seedDatabase(seedData = {}) {
    const results = {};

    // Seed users
    if (seedData.users) {
      const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
      const usersWithHashedPasswords = await Promise.all(
        seedData.users.map(async (user) => ({
          ...user,
          password: await bcrypt.hash(user.password || 'TestPassword123!', config.auth.bcryptRounds)
        }))
      );
      results.users = await User.insertMany(usersWithHashedPasswords);
    }

    // Seed products
    if (seedData.products) {
      const Product = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
      results.products = await Product.insertMany(seedData.products);
    }

    // Seed orders
    if (seedData.orders) {
      const Order = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/order.model');
      results.orders = await Order.insertMany(seedData.orders);
    }

    return results;
  }

  /**
   * Create test database transaction
   */
  async withTransaction(callback) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // === File System Helpers ===

  /**
   * Create temporary directory for tests
   */
  async createTempDir(prefix = 'test') {
    const tempDir = path.join(__dirname, '../.temp', `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.ensureDir(tempDir);
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  /**
   * Create temporary file with content
   */
  async createTempFile(content, filename = null, dir = null) {
    if (!dir) {
      dir = await this.createTempDir('file');
    }
    
    const fileName = filename || `temp-${Date.now()}.txt`;
    const filePath = path.join(dir, fileName);
    
    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Copy fixture file to temp location
   */
  async copyFixture(fixtureName, destination = null) {
    const fixturePath = path.join(__dirname, '../fixtures/files', fixtureName);
    
    if (!(await fs.pathExists(fixturePath))) {
      throw new Error(`Fixture file not found: ${fixtureName}`);
    }

    if (!destination) {
      const tempDir = await this.createTempDir('fixture');
      destination = path.join(tempDir, fixtureName);
    }

    await fs.copy(fixturePath, destination);
    return destination;
  }

  // === HTTP Request Helpers ===

  /**
   * Make authenticated request
   */
  async makeAuthenticatedRequest(app, method, url, userId, data = null) {
    const authHeader = this.getAuthHeader(userId);
    if (!authHeader) {
      throw new Error(`No auth token found for user: ${userId}`);
    }

    let req = request(app)[method.toLowerCase()](url)
      .set('Authorization', authHeader);

    if (data) {
      req = req.send(data);
    }

    return req;
  }

  /**
   * Test API endpoint with various scenarios
   */
  async testEndpoint(app, method, url, testCases = []) {
    const results = [];

    for (const testCase of testCases) {
      const { name, auth, data, expectedStatus, validate } = testCase;
      
      let req = request(app)[method.toLowerCase()](url);
      
      if (auth) {
        req = req.set('Authorization', this.getAuthHeader(auth));
      }
      
      if (data) {
        req = req.send(data);
      }

      const response = await req;
      
      const result = {
        name,
        status: response.status,
        body: response.body,
        passed: response.status === expectedStatus
      };

      if (validate) {
        try {
          await validate(response);
          result.validationPassed = true;
        } catch (error) {
          result.validationPassed = false;
          result.validationError = error.message;
        }
      }

      results.push(result);
    }

    return results;
  }

  // === Performance Testing Helpers ===

  /**
   * Measure execution time
   */
  async measureTime(asyncFunction) {
    const start = process.hrtime.bigint();
    const result = await asyncFunction();
    const end = process.hrtime.bigint();
    
    return {
      result,
      duration: Number(end - start) / 1000000 // Convert to milliseconds
    };
  }

  /**
   * Run concurrent requests
   */
  async runConcurrentRequests(requestFunction, concurrency = 10, duration = 30000) {
    const startTime = Date.now();
    const results = [];
    const errors = [];

    const makeRequest = async () => {
      while (Date.now() - startTime < duration) {
        try {
          const start = process.hrtime.bigint();
          await requestFunction();
          const end = process.hrtime.bigint();
          
          results.push({
            duration: Number(end - start) / 1000000,
            timestamp: Date.now()
          });
        } catch (error) {
          errors.push({
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
    };

    // Start concurrent requests
    const promises = Array(concurrency).fill().map(() => makeRequest());
    await Promise.all(promises);

    // Calculate statistics
    const durations = results.map(r => r.duration);
    const stats = {
      totalRequests: results.length,
      totalErrors: errors.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99),
      requestsPerSecond: results.length / (duration / 1000),
      errorRate: errors.length / (results.length + errors.length)
    };

    return { results, errors, stats };
  }

  /**
   * Calculate percentile from array of numbers
   */
  percentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index];
  }

  // === Memory Testing Helpers ===

  /**
   * Monitor memory usage during test execution
   */
  async monitorMemory(testFunction, interval = 100) {
    const measurements = [];
    const initialMemory = process.memoryUsage();
    
    const monitor = setInterval(() => {
      measurements.push({
        ...process.memoryUsage(),
        timestamp: Date.now()
      });
    }, interval);

    try {
      const result = await testFunction();
      clearInterval(monitor);
      
      const finalMemory = process.memoryUsage();
      
      return {
        result,
        initialMemory,
        finalMemory,
        measurements,
        memoryGrowth: {
          heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
          external: finalMemory.external - initialMemory.external,
          rss: finalMemory.rss - initialMemory.rss
        }
      };
    } catch (error) {
      clearInterval(monitor);
      throw error;
    }
  }

  // === Validation Helpers ===

  /**
   * Validate API response structure
   */
  validateApiResponse(response, schema) {
    const { status, body } = response;
    
    // Basic structure validation
    if (status >= 200 && status < 300) {
      if (!body.success) {
        throw new Error('Success response should have success: true');
      }
      if (schema.requiresData && !body.data) {
        throw new Error('Success response should have data property');
      }
    } else {
      if (body.success) {
        throw new Error('Error response should have success: false');
      }
      if (!body.error) {
        throw new Error('Error response should have error property');
      }
    }

    // Custom validation
    if (schema.validate) {
      schema.validate(body);
    }

    return true;
  }

  /**
   * Assert array contains expected items
   */
  assertArrayContains(array, expectedItems, message = 'Array should contain expected items') {
    for (const item of expectedItems) {
      if (!array.includes(item)) {
        throw new Error(`${message}: Missing ${item}`);
      }
    }
  }

  /**
   * Assert object has required properties
   */
  assertObjectHasProperties(obj, properties, message = 'Object should have required properties') {
    for (const prop of properties) {
      if (!(prop in obj)) {
        throw new Error(`${message}: Missing property ${prop}`);
      }
    }
  }

  // === Utility Helpers ===

  /**
   * Wait for specified time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   */
  async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempts - 1);
        await this.wait(delay);
      }
    }
  }

  /**
   * Generate random string
   */
  randomString(length = 10, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  randomEmail(domain = 'example.com') {
    return `test${Date.now()}${this.randomString(5)}@${domain}`;
  }

  /**
   * Generate test data based on schema
   */
  generateTestData(schema) {
    const data = {};
    
    for (const [key, config] of Object.entries(schema)) {
      switch (config.type) {
        case 'string':
          data[key] = config.default || this.randomString(config.length || 10);
          break;
        case 'email':
          data[key] = config.default || this.randomEmail();
          break;
        case 'number':
          data[key] = config.default || Math.floor(Math.random() * 100);
          break;
        case 'boolean':
          data[key] = config.default !== undefined ? config.default : Math.random() > 0.5;
          break;
        case 'array':
          data[key] = config.default || [];
          break;
        case 'object':
          data[key] = config.default || {};
          break;
        default:
          data[key] = config.default || null;
      }
    }
    
    return data;
  }

  // === Cleanup Methods ===

  /**
   * Clean up all temporary resources
   */
  async cleanup() {
    // Clean up temporary directories
    for (const tempDir of this.tempDirs) {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
      }
    }
    this.tempDirs = [];

    // Clean up created users
    if (this.createdUsers.length > 0) {
      try {
        const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
        await User.deleteMany({ _id: { $in: this.createdUsers } });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.createdUsers = [];

    // Clear auth tokens
    this.authTokens.clear();
  }
}

// Export singleton instance
const testHelpers = new TestHelpers();

// Export both the class and instance
module.exports = {
  TestHelpers,
  testHelpers
};