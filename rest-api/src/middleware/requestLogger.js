import { createLogger, transports, format } from 'winston';

// Request logger configuration
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/requests.log' }),
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      )
    })
  ]
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response details
  res.send = function(body) {
    const duration = Date.now() - start;
    const contentLength = Buffer.byteLength(body || '', 'utf8');
    
    // Log request details
    logger.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: `${contentLength} bytes`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || 'anonymous'
    });
    
    // Call original send method
    return originalSend.call(this, body);
  };
  
  next();
};

// API analytics middleware
export const analyticsLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log API usage analytics
    logger.info('API_ANALYTICS', {
      endpoint: req.route?.path || req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      responseTime: duration,
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      userRole: req.user?.role,
      success: res.statusCode < 400
    });
  });
  
  next();
};