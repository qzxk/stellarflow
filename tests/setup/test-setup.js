const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Redis = require('ioredis-mock');

// Global test setup configuration
class TestSetup {
  constructor() {
    this.mongoServer = null;
    this.redisClient = null;
    this.originalRedis = null;
  }

  async setupDatabase() {
    // Start in-memory MongoDB instance
    this.mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0',
        downloadDir: './node_modules/.cache/mongodb-memory-server',
      },
      instance: {
        dbName: 'test-database',
        port: 27017,
      },
    });

    const mongoUri = this.mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Test database connected');
  }

  setupRedis() {
    // Mock Redis for testing
    const redisConfig = require('../../examples/05-swarm-apps/rest-api-advanced/src/config/redis');
    
    // Store original function
    this.originalRedis = redisConfig.getRedisClient;
    
    // Create mock Redis client
    this.redisClient = new Redis();
    
    // Override getRedisClient function
    redisConfig.getRedisClient = () => this.redisClient;
    
    console.log('✅ Test Redis client mocked');
  }

  async teardownDatabase() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    if (this.mongoServer) {
      await this.mongoServer.stop();
    }

    console.log('✅ Test database cleaned up');
  }

  teardownRedis() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }

    // Restore original function
    if (this.originalRedis) {
      const redisConfig = require('../../examples/05-swarm-apps/rest-api-advanced/src/config/redis');
      redisConfig.getRedisClient = this.originalRedis;
    }

    console.log('✅ Test Redis client cleaned up');
  }

  setupEnvironment() {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.JWT_EXPIRE = '7d';
    process.env.BCRYPT_ROUNDS = '4'; // Faster hashing for tests
    process.env.API_URL = 'http://localhost:3000';
    process.env.REDIS_URL = 'redis://localhost:6379';
    
    // Disable logging in tests
    process.env.LOG_LEVEL = 'error';
    
    console.log('✅ Test environment configured');
  }

  async setupTestData() {
    // Clear all collections
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }

    console.log('✅ Test data cleared');
  }

  mockExternalServices() {
    // Mock email service
    jest.mock('../../examples/05-swarm-apps/rest-api-advanced/src/services/email.service', () => ({
      sendEmail: jest.fn().mockResolvedValue(true),
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    }));

    // Mock file upload service
    jest.mock('../../examples/05-swarm-apps/rest-api-advanced/src/services/upload.service', () => ({
      uploadFile: jest.fn().mockResolvedValue({
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        size: 12345,
      }),
      deleteFile: jest.fn().mockResolvedValue(true),
    }));

    // Mock payment service
    jest.mock('../../examples/05-swarm-apps/rest-api-advanced/src/services/payment.service', () => ({
      processPayment: jest.fn().mockResolvedValue({
        transactionId: 'test-transaction-123',
        status: 'completed',
        amount: 99.99,
      }),
      refundPayment: jest.fn().mockResolvedValue({
        refundId: 'test-refund-123',
        status: 'completed',
        amount: 99.99,
      }),
    }));

    console.log('✅ External services mocked');
  }

  async setupAll() {
    this.setupEnvironment();
    await this.setupDatabase();
    this.setupRedis();
    this.mockExternalServices();
    await this.setupTestData();
  }

  async teardownAll() {
    await this.teardownDatabase();
    this.teardownRedis();
  }
}

// Global test setup instance
const testSetup = new TestSetup();

// Jest setup hooks
beforeAll(async () => {
  await testSetup.setupAll();
}, 30000); // 30 second timeout

afterAll(async () => {
  await testSetup.teardownAll();
}, 10000); // 10 second timeout

beforeEach(async () => {
  await testSetup.setupTestData();
});

// Global test utilities
global.testSetup = testSetup;

// Custom Jest matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },

  toHaveValidationError(received, field) {
    const hasError = received.body.errors && 
      received.body.errors.some(error => error.field === field);
    
    if (hasError) {
      return {
        message: () => `expected response not to have validation error for field ${field}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response to have validation error for field ${field}`,
        pass: false,
      };
    }
  },

  toBeWithinTimeRange(received, expected, toleranceMs = 1000) {
    const receivedTime = new Date(received).getTime();
    const expectedTime = new Date(expected).getTime();
    const difference = Math.abs(receivedTime - expectedTime);
    
    if (difference <= toleranceMs) {
      return {
        message: () => `expected ${received} not to be within ${toleranceMs}ms of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${toleranceMs}ms of ${expected}`,
        pass: false,
      };
    }
  },
});

// Test utilities
global.testUtils = {
  generateValidUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: 'TestPass123!',
    name: 'Test User',
  }),

  generateValidProduct: () => ({
    name: `Test Product ${Date.now()}`,
    description: 'Test product description',
    price: 99.99,
    category: 'electronics',
    stock: 10,
  }),

  generateValidOrder: (userId, productIds) => ({
    user: userId,
    items: productIds.map(id => ({
      product: id,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: Math.random() * 100 + 10,
    })),
    shippingAddress: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'Test Country',
    },
  }),

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  generateRandomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Console configuration for tests
if (process.env.NODE_ENV === 'test') {
  // Suppress console.log in tests unless explicitly needed
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsoleLog(...args);
    }
  };
}

module.exports = testSetup;