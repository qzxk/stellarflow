/**
 * Database Mocking Utilities
 * Provides comprehensive database mocking for testing
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

class DatabaseMock {
  constructor() {
    this.mongoServer = null;
    this.connection = null;
  }

  /**
   * Start in-memory MongoDB instance
   */
  async connect() {
    this.mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.0',
      },
      instance: {
        dbName: 'test-database',
      },
    });

    const mongoUri = this.mongoServer.getUri();
    this.connection = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    return this.connection;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    if (this.connection) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }

    if (this.mongoServer) {
      await this.mongoServer.stop();
    }
  }

  /**
   * Clear all collections
   */
  async clearDatabase() {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }

  /**
   * Seed database with test data
   */
  async seedDatabase(seedData = {}) {
    await this.clearDatabase();

    const results = {};

    // Seed users
    if (seedData.users) {
      const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
      results.users = await User.insertMany(seedData.users);
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
   * Mock database operations for unit tests
   */
  mockOperations() {
    const mockDocument = {
      save: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({}),
      toObject: jest.fn().mockReturnValue({}),
      toJSON: jest.fn().mockReturnValue({})
    };

    const mockModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }),
      findById: jest.fn().mockResolvedValue(mockDocument),
      findOne: jest.fn().mockResolvedValue(mockDocument),
      findOneAndUpdate: jest.fn().mockResolvedValue(mockDocument),
      findOneAndDelete: jest.fn().mockResolvedValue(mockDocument),
      create: jest.fn().mockResolvedValue(mockDocument),
      insertMany: jest.fn().mockResolvedValue([mockDocument]),
      updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
      updateMany: jest.fn().mockResolvedValue({ nModified: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      countDocuments: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      })
    };

    return { mockModel, mockDocument };
  }

  /**
   * Create test data generators
   */
  generators() {
    return {
      user: (overrides = {}) => ({
        _id: new mongoose.Types.ObjectId(),
        email: `test${Date.now()}@example.com`,
        password: '$2a$12$hashedPasswordExample',
        name: 'Test User',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
      }),

      product: (overrides = {}) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `Test Product ${Date.now()}`,
        description: 'Test product description',
        price: 29.99,
        category: 'electronics',
        stock: 100,
        images: ['test-image.jpg'],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
      }),

      order: (overrides = {}) => ({
        _id: new mongoose.Types.ObjectId(),
        user: new mongoose.Types.ObjectId(),
        items: [{
          product: new mongoose.Types.ObjectId(),
          quantity: 2,
          price: 29.99
        }],
        total: 59.98,
        status: 'pending',
        shippingAddress: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          zipCode: '12345',
          country: 'Test Country'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
      })
    };
  }

  /**
   * Transaction mock for testing
   */
  mockTransaction() {
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };

    mongoose.startSession = jest.fn().mockResolvedValue(session);

    return session;
  }

  /**
   * Connection mock for testing
   */
  mockConnection() {
    const connection = {
      readyState: 1, // Connected
      db: {
        collections: jest.fn().mockResolvedValue([]),
        dropDatabase: jest.fn().mockResolvedValue(true)
      },
      close: jest.fn().mockResolvedValue(true)
    };

    mongoose.connection = connection;

    return connection;
  }
}

// Singleton instance
const databaseMock = new DatabaseMock();

// Common test data
const testData = {
  users: [
    {
      email: 'admin@example.com',
      password: '$2a$12$adminHashedPassword',
      name: 'Admin User',
      role: 'admin',
      status: 'active'
    },
    {
      email: 'user@example.com',
      password: '$2a$12$userHashedPassword',
      name: 'Regular User',
      role: 'user',
      status: 'active'
    },
    {
      email: 'suspended@example.com',
      password: '$2a$12$suspendedHashedPassword',
      name: 'Suspended User',
      role: 'user',
      status: 'suspended'
    }
  ],

  products: [
    {
      name: 'Laptop',
      description: 'High-performance laptop',
      price: 999.99,
      category: 'electronics',
      stock: 50
    },
    {
      name: 'Smartphone',
      description: 'Latest smartphone',
      price: 699.99,
      category: 'electronics',
      stock: 100
    },
    {
      name: 'Headphones',
      description: 'Wireless headphones',
      price: 199.99,
      category: 'electronics',
      stock: 75
    }
  ],

  orders: [
    {
      status: 'pending',
      total: 999.99,
      items: [{ quantity: 1, price: 999.99 }]
    },
    {
      status: 'completed',
      total: 699.99,
      items: [{ quantity: 1, price: 699.99 }]
    }
  ]
};

module.exports = {
  DatabaseMock,
  databaseMock,
  testData
};