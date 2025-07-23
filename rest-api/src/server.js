import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import { Database } from './config/database.js';
import { initializeLoginAttemptsTable } from './middleware/rateLimiter.js';
import { initializeSecurityTables } from './utils/security.js';
import { apiLimiter, suspiciousActivityDetector } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { initializeApiKeyTables } from './middleware/apiKeyAuth.js';
import { twoFactorAuth } from './utils/twoFactorAuth.js';
import { 
  advancedSanitization, 
  advancedCors, 
  advancedSecurityHeaders,
  ddosProtection,
  securityMonitoring,
  requestSizeLimiter,
  contentTypeValidator
} from './middleware/advancedSecurity.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import productRoutes from './routes/products.js';
import apiKeyRoutes from './routes/apiKeys.js';
import twoFactorRoutes from './routes/twoFactor.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stellarflow-api' },
  transports: [
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || 'logs/combined.log' 
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize database and security features
const initializeServer = async () => {
  try {
    // Initialize database
    await Database.initialize();
    console.log('✅ Database initialized');
    
    // Initialize security tables
    await initializeSecurityTables();
    console.log('✅ Security tables initialized');
    
    // Initialize rate limiting tables
    await initializeLoginAttemptsTable();
    console.log('✅ Rate limiting initialized');
    
    // Initialize API key tables
    await initializeApiKeyTables();
    console.log('✅ API key tables initialized');
    
    // Initialize 2FA tables
    await twoFactorAuth.initializeTables();
    console.log('✅ 2FA tables initialized');
    
    return true;
  } catch (error) {
    logger.error('Server initialization failed:', error);
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
};

// Security middleware (apply first)
app.use(advancedSecurityHeaders());

// Trust proxy (important for accurate IP detection behind reverse proxy)
app.set('trust proxy', 1);

// Advanced CORS configuration
app.use(advancedCors());

// DDoS protection
app.use(ddosProtection());

// Request size limiting
app.use(requestSizeLimiter('10mb'));

// Content type validation
app.use(contentTypeValidator(['application/json', 'application/x-www-form-urlencoded']));

// Advanced input sanitization
app.use(advancedSanitization);

// Security monitoring
app.use(securityMonitoring);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Suspicious activity detection
app.use(suspiciousActivityDetector);

// General API rate limiting
app.use(apiLimiter);

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/2fa', twoFactorRoutes);

// CSP violation report endpoint
app.post('/api/security/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  logger.warn('CSP Violation:', req.body);
  res.status(204).end();
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  
  try {
    await Database.close();
    logger.info('Database connection closed');
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  console.log('🔄 SIGINT received, shutting down gracefully...');
  
  try {
    await Database.close();
    logger.info('Database connection closed');
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
const startServer = async () => {
  await initializeServer();
  
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`🚀 StellarFlow API server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Security features enabled`);
    console.log(`⚡ Rate limiting active`);
    console.log(`📝 Logging to: ${process.env.LOG_FILE || 'logs/combined.log'}`);
  });
  
  return server;
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    logger.error('Failed to start server:', error);
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  });
}

export default app;
export { startServer };
