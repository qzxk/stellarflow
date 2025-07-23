/**
 * Test Configuration
 * Centralized configuration for all test environments and scenarios
 */

const path = require('path');

// Base configuration
const baseConfig = {
  // Test environment settings
  environment: {
    nodeEnv: process.env.NODE_ENV || 'test',
    testEnv: process.env.TEST_ENV || 'test',
    claudeFlowEnv: 'test',
    testMode: true,
    sqliteMemory: true,
    disableTerminalColors: true
  },

  // Database configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/claude-flow-test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
        bufferCommands: false
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      options: {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      }
    },
    sqlite: {
      memory: true,
      filename: ':memory:',
      options: {
        verbose: false,
        fileMustExist: false
      }
    }
  },

  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    jwtExpire: process.env.JWT_EXPIRE || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 4, // Faster for tests
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000 // 15 minutes
  },

  // API configuration
  api: {
    url: process.env.API_URL || 'http://localhost:3000',
    port: parseInt(process.env.PORT) || 3000,
    timeout: 30000, // 30 seconds
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // Much higher for tests
    }
  },

  // Test execution settings
  execution: {
    timeout: {
      unit: 10000,      // 10 seconds
      integration: 30000, // 30 seconds
      e2e: 60000,       // 60 seconds
      performance: 120000 // 2 minutes
    },
    retries: {
      unit: 0,
      integration: 1,
      e2e: 2,
      performance: 0
    },
    concurrency: {
      unit: 4,
      integration: 2,
      e2e: 1,
      performance: 1
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'error',
    silent: process.env.SILENT_TESTS === 'true',
    verbose: process.env.VERBOSE_TESTS === 'true',
    logFile: path.join(__dirname, '../logs/test.log')
  },

  // Coverage settings
  coverage: {
    enabled: process.env.COVERAGE !== 'false',
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      individual: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    include: [
      'src/**/*.js',
      'src/**/*.ts',
      'examples/**/src/**/*.js'
    ],
    exclude: [
      'src/**/*.test.js',
      'src/**/*.spec.js',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/*.d.ts',
      'coverage/**',
      'tests/**',
      'node_modules/**',
      'dist/**',
      'bin/**'
    ]
  },

  // Mock configuration
  mocks: {
    enabled: true,
    clearBetweenTests: true,
    resetBetweenTests: true,
    external: {
      email: true,
      payment: true,
      fileUpload: true,
      notifications: true
    }
  },

  // Fixtures and test data
  fixtures: {
    users: {
      admin: {
        count: 1,
        role: 'admin'
      },
      managers: {
        count: 2,
        role: 'manager'
      },
      users: {
        count: 10,
        role: 'user'
      }
    },
    products: {
      count: 20,
      categories: ['electronics', 'books', 'clothing', 'home']
    },
    orders: {
      count: 50,
      statuses: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    }
  },

  // Performance testing settings
  performance: {
    concurrent: {
      light: 10,
      medium: 25,
      heavy: 50
    },
    duration: {
      short: 30000,   // 30 seconds
      medium: 60000,  // 1 minute
      long: 300000    // 5 minutes
    },
    thresholds: {
      responseTime: {
        p95: 1000,    // 95th percentile under 1s
        p99: 2000     // 99th percentile under 2s
      },
      throughput: {
        minimum: 10   // requests per second
      },
      errorRate: {
        maximum: 0.01 // 1% error rate
      }
    }
  },

  // Security testing settings
  security: {
    audit: {
      level: 'moderate',
      skipDevDependencies: false
    },
    vulnerabilities: {
      maxHigh: 0,
      maxMedium: 2,
      maxLow: 10
    },
    headers: {
      required: [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ]
    }
  },

  // CI/CD specific settings
  ci: {
    enabled: process.env.CI === 'true',
    provider: process.env.CI_PROVIDER || 'github',
    parallel: process.env.CI_PARALLEL !== 'false',
    artifacts: {
      retention: '7d',
      paths: [
        'coverage/',
        'test-reports/',
        'screenshots/',
        'performance-results/'
      ]
    }
  }
};

// Environment-specific configurations
const environments = {
  development: {
    ...baseConfig,
    logging: {
      ...baseConfig.logging,
      level: 'debug',
      verbose: true
    },
    execution: {
      ...baseConfig.execution,
      timeout: {
        ...baseConfig.execution.timeout,
        unit: 15000,
        integration: 45000
      }
    }
  },

  test: {
    ...baseConfig,
    // Test environment uses base config as-is
  },

  ci: {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      mongodb: {
        ...baseConfig.database.mongodb,
        uri: process.env.MONGODB_URI || 'mongodb://testuser:testpass@localhost:27017/testdb?authSource=admin'
      }
    },
    execution: {
      ...baseConfig.execution,
      concurrency: {
        unit: 2,        // Lower concurrency in CI
        integration: 1,
        e2e: 1,
        performance: 1
      }
    },
    logging: {
      ...baseConfig.logging,
      silent: false,    // Keep logs in CI for debugging
      verbose: true
    },
    performance: {
      ...baseConfig.performance,
      thresholds: {
        ...baseConfig.performance.thresholds,
        responseTime: {
          p95: 2000,    // More lenient in CI
          p99: 5000
        }
      }
    }
  },

  production: {
    ...baseConfig,
    // Production testing with stricter requirements
    coverage: {
      ...baseConfig.coverage,
      threshold: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    security: {
      ...baseConfig.security,
      vulnerabilities: {
        maxHigh: 0,
        maxMedium: 0,
        maxLow: 0
      }
    }
  }
};

// Helper functions
const getConfig = (env = process.env.NODE_ENV || 'test') => {
  const config = environments[env] || environments.test;
  
  // Override with CI-specific settings if in CI
  if (process.env.CI === 'true') {
    return {
      ...config,
      ...environments.ci,
      environment: {
        ...config.environment,
        ci: true
      }
    };
  }
  
  return config;
};

const isCI = () => process.env.CI === 'true';
const isDevelopment = () => process.env.NODE_ENV === 'development';
const isTest = () => process.env.NODE_ENV === 'test';
const isProduction = () => process.env.NODE_ENV === 'production';

// Validation functions
const validateConfig = (config) => {
  const required = ['environment', 'database', 'auth', 'api'];
  
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required configuration section: ${key}`);
    }
  }
  
  // Validate database URLs
  if (config.database.mongodb.uri && !config.database.mongodb.uri.startsWith('mongodb://')) {
    throw new Error('Invalid MongoDB URI format');
  }
  
  if (config.database.redis.url && !config.database.redis.url.startsWith('redis://')) {
    throw new Error('Invalid Redis URL format');
  }
  
  // Validate timeouts
  if (config.execution.timeout.unit < 1000) {
    throw new Error('Unit test timeout too low (minimum 1000ms)');
  }
  
  return true;
};

const getTestPattern = (type) => {
  const patterns = {
    unit: 'tests/unit/**/*.test.js',
    integration: 'tests/integration/**/*.test.js',
    e2e: 'tests/e2e/**/*.test.js',
    performance: 'tests/performance/**/*.test.js',
    security: 'tests/security/**/*.test.js',
    all: 'tests/**/*.test.js'
  };
  
  return patterns[type] || patterns.all;
};

// Export configuration
module.exports = {
  getConfig,
  isCI,
  isDevelopment,
  isTest,
  isProduction,
  validateConfig,
  getTestPattern,
  environments,
  baseConfig
};