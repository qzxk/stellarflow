/**
 * Database Configuration and Connection
 * MongoDB connection setup with Mongoose
 */

const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // Determine database URI based on environment
    const dbUri = config.env === 'test' ? config.database.testUri : config.database.uri;
    
    // Connection options
    const options = {
      ...config.database.options,
      autoIndex: config.env !== 'production', // Don't build indexes in production
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
    };
    
    // Connect to MongoDB
    const conn = await mongoose.connect(dbUri, options);
    
    logger.info(`🗄️  MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    
    // Log database events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    
    // Exit process with failure in production
    if (config.env === 'production') {
      process.exit(1);
    }
    
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

/**
 * Clear database (for testing purposes)
 * @returns {Promise<void>}
 */
const clearDB = async () => {
  if (config.env !== 'test') {
    throw new Error('Database clearing is only allowed in test environment');
  }
  
  try {
    const collections = mongoose.connection.collections;
    
    await Promise.all(
      Object.values(collections).map(collection => collection.deleteMany({}))
    );
    
    logger.info('Test database cleared');
  } catch (error) {
    logger.error('Error clearing test database:', error);
    throw error;
  }
};

/**
 * Check database connection health
 * @returns {Promise<boolean>}
 */
const checkDBHealth = async () => {
  try {
    const state = mongoose.connection.readyState;
    
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
      // Perform a simple operation to ensure database is responsive
      await mongoose.connection.db.admin().ping();
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

/**
 * Get database connection statistics
 * @returns {Object}
 */
const getDBStats = () => {
  const connection = mongoose.connection;
  
  return {
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    collections: Object.keys(connection.collections).length,
    models: Object.keys(mongoose.models).length,
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  clearDB,
  checkDBHealth,
  getDBStats,
};