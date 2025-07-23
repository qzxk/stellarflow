const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🚀 Starting global test setup...');
  
  // Create necessary directories
  const directories = [
    path.join(__dirname, '../../coverage'),
    path.join(__dirname, '../../logs/test'),
    path.join(__dirname, '../../temp/test'),
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error(`❌ Failed to create directory ${dir}:`, error.message);
      }
    }
  }
  
  // Set global test environment
  process.env.NODE_ENV = 'test';
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-do-not-use-in-production';
  process.env.JWT_EXPIRE = '1h';
  process.env.API_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'error';
  
  // Database configuration
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-database';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  
  // Disable external services in tests
  process.env.DISABLE_EMAIL_SERVICE = 'true';
  process.env.DISABLE_SMS_SERVICE = 'true';
  process.env.DISABLE_PUSH_NOTIFICATIONS = 'true';
  
  // Performance settings for tests
  process.env.BCRYPT_ROUNDS = '4'; // Faster password hashing
  process.env.JWT_ALGORITHM = 'HS256';
  
  // Create test configuration file
  const testConfig = {
    database: {
      mongodb: {
        uri: process.env.MONGODB_URI,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
      },
      redis: {
        url: process.env.REDIS_URL,
        options: {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
        },
      },
    },
    auth: {
      jwt: {
        secret: process.env.JWT_SECRET,
        expire: process.env.JWT_EXPIRE,
        algorithm: process.env.JWT_ALGORITHM,
      },
      bcrypt: {
        rounds: parseInt(process.env.BCRYPT_ROUNDS, 10),
      },
    },
    server: {
      port: 3001, // Different port for tests
      host: 'localhost',
    },
    external: {
      email: {
        enabled: false,
        provider: 'mock',
      },
      sms: {
        enabled: false,
        provider: 'mock',
      },
      storage: {
        provider: 'local',
        path: path.join(__dirname, '../../temp/test/uploads'),
      },
    },
    logging: {
      level: process.env.LOG_LEVEL,
      file: path.join(__dirname, '../../logs/test/test.log'),
    },
  };
  
  const configPath = path.join(__dirname, '../config/test-config.json');
  await fs.writeFile(configPath, JSON.stringify(testConfig, null, 2));
  console.log(`✅ Created test configuration: ${configPath}`);
  
  // Initialize test database if needed
  console.log('📊 Setting up test database schema...');
  
  // Global test utilities
  global.TEST_CONFIG = testConfig;
  global.TEST_START_TIME = Date.now();
  
  console.log('✅ Global test setup completed');
};