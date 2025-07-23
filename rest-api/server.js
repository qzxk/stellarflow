import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createLogger, transports, format } from 'winston';
import { Database } from './src/config/database.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import postRoutes from './src/routes/posts.js';
import commentRoutes from './src/routes/comments.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requestLogger } from './src/middleware/requestLogger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Logger configuration
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'StellarFlow REST API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login user',
        'POST /api/auth/logout': 'Logout user',
        'POST /api/auth/refresh': 'Refresh access token'
      },
      users: {
        'GET /api/users': 'Get all users (admin only)',
        'GET /api/users/profile': 'Get current user profile',
        'PUT /api/users/profile': 'Update user profile',
        'DELETE /api/users/:id': 'Delete user (admin only)'
      },
      posts: {
        'GET /api/posts': 'Get all posts',
        'POST /api/posts': 'Create new post',
        'GET /api/posts/:id': 'Get post by ID',
        'PUT /api/posts/:id': 'Update post',
        'DELETE /api/posts/:id': 'Delete post'
      },
      comments: {
        'GET /api/posts/:postId/comments': 'Get comments for post',
        'POST /api/posts/:postId/comments': 'Create comment',
        'PUT /api/comments/:id': 'Update comment',
        'DELETE /api/comments/:id': 'Delete comment'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await Database.initialize();
    logger.info('Database initialized successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API documentation: http://localhost:${PORT}/api`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await Database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await Database.close();
  process.exit(0);
});

startServer();

export default app;