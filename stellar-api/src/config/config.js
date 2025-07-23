/**
 * Application Configuration
 * Centralized configuration management with environment-based settings
 */

require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Server Configuration
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || 'localhost',
  
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stellar_api_dev',
    testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/stellar_api_test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 50,
      wtimeoutMS: 2500,
      useCreateIndex: true,
    },
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256',
    issuer: 'stellar-api',
    audience: 'stellar-api-users',
  },
  
  // Security Configuration
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    maxLoginAttempts: 5,
    lockoutTime: 2 * 60 * 60 * 1000, // 2 hours
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSymbols: true,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    from: process.env.EMAIL_FROM || 'noreply@stellar-api.com',
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
    ],
    uploadPath: process.env.UPLOAD_PATH || 'uploads/',
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: '20m',
    maxFiles: '14d',
  },
  
  // Redis Configuration (Optional)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    ttl: 60 * 60, // 1 hour default TTL
  },
  
  // API Documentation
  apiDocs: {
    enabled: process.env.API_DOCS_ENABLED !== 'false',
    path: process.env.API_DOCS_PATH || '/api-docs',
  },
  
  // Health Check
  healthCheck: {
    endpoint: process.env.HEALTH_CHECK_ENDPOINT || '/health',
  },
  
  // Pagination Defaults
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Cache Configuration
  cache: {
    defaultTTL: 60 * 60, // 1 hour
    maxKeys: 1000,
  },
  
  // Feature Flags
  features: {
    emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
    twoFactorAuth: process.env.FEATURE_2FA === 'true',
    socialLogin: process.env.FEATURE_SOCIAL_LOGIN === 'true',
    fileUploads: process.env.FEATURE_FILE_UPLOADS !== 'false',
  },
};

// Validation for critical configuration
const validateConfig = () => {
  const requiredConfigs = ['jwt.secret', 'database.uri'];
  const missingConfigs = [];
  
  requiredConfigs.forEach(configPath => {
    const keys = configPath.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        missingConfigs.push(configPath);
        break;
      }
    }
  });
  
  if (missingConfigs.length > 0) {
    throw new Error(`Missing required configuration: ${missingConfigs.join(', ')}`);
  }
  
  // Validate JWT secret in production
  if (config.env === 'production' && config.jwt.secret === 'fallback-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
};

// Validate configuration on startup
validateConfig();

module.exports = config;