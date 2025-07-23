# REST API Architecture Document

## 1. Overview

This document outlines the architecture for a scalable, secure, and maintainable REST API built with Node.js and Express. The API follows RESTful principles and implements best practices for modern web services.

### 1.1 Core Technologies
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL (primary) with Redis (caching)
- **Authentication**: JWT (JSON Web Tokens)
- **Documentation**: OpenAPI 3.0 (Swagger)
- **Testing**: Jest + Supertest
- **Monitoring**: Winston (logging) + Prometheus (metrics)

### 1.2 Design Principles
- RESTful architecture
- Stateless authentication
- Layered architecture (Controller → Service → Repository)
- API versioning
- Comprehensive error handling
- Request validation
- Rate limiting and security measures

## 2. API Structure

### 2.1 Base URL and Versioning
```
https://api.example.com/v1
```

- Version included in URL path
- Semantic versioning for API changes
- Backward compatibility maintained within major versions

### 2.2 Resource Endpoints

#### Authentication Endpoints
```
POST   /v1/auth/register     - User registration
POST   /v1/auth/login        - User login
POST   /v1/auth/logout       - User logout
POST   /v1/auth/refresh      - Refresh access token
POST   /v1/auth/forgot       - Request password reset
POST   /v1/auth/reset        - Reset password
GET    /v1/auth/verify/:token - Verify email address
```

#### User Management Endpoints
```
GET    /v1/users            - List users (admin only)
GET    /v1/users/:id        - Get user by ID
GET    /v1/users/profile    - Get current user profile
PUT    /v1/users/:id        - Update user
PATCH  /v1/users/:id        - Partial update user
DELETE /v1/users/:id        - Delete user (soft delete)
POST   /v1/users/:id/avatar - Upload user avatar
```

#### Resource Domain: Products (Example)
```
GET    /v1/products         - List products (paginated)
GET    /v1/products/:id     - Get product by ID
POST   /v1/products         - Create product
PUT    /v1/products/:id     - Update product
PATCH  /v1/products/:id     - Partial update product
DELETE /v1/products/:id     - Delete product

# Nested resources
GET    /v1/products/:id/reviews      - Get product reviews
POST   /v1/products/:id/reviews      - Add product review
PUT    /v1/products/:id/reviews/:rid - Update review
DELETE /v1/products/:id/reviews/:rid - Delete review

# Bulk operations
POST   /v1/products/bulk     - Create multiple products
PUT    /v1/products/bulk     - Update multiple products
DELETE /v1/products/bulk     - Delete multiple products
```

### 2.3 HTTP Methods and Status Codes

#### HTTP Methods
- **GET**: Retrieve resources
- **POST**: Create new resources
- **PUT**: Full update of resources
- **PATCH**: Partial update of resources
- **DELETE**: Remove resources

#### Standard Status Codes
- **200 OK**: Successful GET, PUT, PATCH
- **201 Created**: Successful POST with resource creation
- **204 No Content**: Successful DELETE
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Authenticated but not authorized
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## 3. Request/Response Format

### 3.1 Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt-token>
X-Request-ID: <uuid>
```

### 3.2 Request Body Structure
```json
{
  "data": {
    "attributes": {
      "name": "Product Name",
      "price": 99.99,
      "category": "electronics"
    }
  }
}
```

### 3.3 Response Structure

#### Success Response
```json
{
  "success": true,
  "data": {
    "id": "123",
    "type": "product",
    "attributes": {
      "name": "Product Name",
      "price": 99.99,
      "category": "electronics"
    },
    "relationships": {
      "reviews": {
        "links": {
          "self": "/v1/products/123/reviews"
        }
      }
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/v1/users",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "links": {
    "self": "/v1/products?page=1&perPage=20",
    "first": "/v1/products?page=1&perPage=20",
    "last": "/v1/products?page=5&perPage=20",
    "next": "/v1/products?page=2&perPage=20",
    "prev": null
  }
}
```

## 4. Middleware Stack

### 4.1 Order of Execution
1. **Request Logger** - Log all incoming requests
2. **Request ID** - Assign unique ID to each request
3. **Security Headers** - Set security headers (helmet)
4. **CORS** - Handle cross-origin requests
5. **Body Parser** - Parse JSON/URL-encoded bodies
6. **Rate Limiter** - Prevent abuse
7. **Authentication** - Verify JWT tokens
8. **Authorization** - Check permissions
9. **Validation** - Validate request data
10. **Business Logic** - Route handlers
11. **Error Handler** - Catch and format errors
12. **Response Logger** - Log response details

### 4.2 Middleware Implementations

#### Authentication Middleware
```javascript
// Verify JWT and attach user to request
async function authenticate(req, res, next) {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await userService.findById(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### Validation Middleware
```javascript
// Validate request against schema
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(422).json({
        error: 'Validation failed',
        details: error.details
      });
    }
    req.validatedBody = value;
    next();
  };
}
```

#### Rate Limiting
```javascript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
```

## 5. Authentication & Authorization

### 5.1 JWT Token Strategy

#### Token Types
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

#### Token Payload
```json
{
  "userId": "123",
  "email": "user@example.com",
  "roles": ["user", "admin"],
  "permissions": ["read:products", "write:products"],
  "iat": 1642339200,
  "exp": 1642340100
}
```

### 5.2 Permission System

#### Role-Based Access Control (RBAC)
```javascript
const permissions = {
  admin: [
    'users:read', 'users:write', 'users:delete',
    'products:read', 'products:write', 'products:delete'
  ],
  user: [
    'users:read:own', 'users:write:own',
    'products:read'
  ],
  guest: [
    'products:read'
  ]
};
```

#### Resource-Based Permissions
```javascript
// Check if user can access specific resource
async function canAccess(user, resource, action) {
  // Check role-based permissions
  if (hasPermission(user.roles, `${resource}:${action}`)) return true;
  
  // Check ownership
  if (action === 'read' || action === 'write') {
    return resource.ownerId === user.id;
  }
  
  return false;
}
```

## 6. Database Architecture

### 6.1 Schema Design

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  email_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  roles TEXT[] DEFAULT ARRAY['user'],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  sku VARCHAR(100) UNIQUE,
  stock_quantity INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### Audit Log Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 Database Patterns

#### Soft Deletes
- Use `deleted_at` timestamp instead of hard deletes
- Filter out soft-deleted records in queries
- Maintain data integrity and audit trail

#### Optimistic Locking
- Use `version` or `updated_at` fields
- Prevent concurrent update conflicts
- Return 409 Conflict on version mismatch

## 7. Error Handling

### 7.1 Error Types

```javascript
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

### 7.2 Global Error Handler

```javascript
function errorHandler(err, req, res, next) {
  let { statusCode = 500, message } = err;
  
  // Log error
  logger.error({
    error: err,
    request: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Don't leak error details in production
  if (!err.isOperational && process.env.NODE_ENV === 'production') {
    statusCode = 500;
    message = 'Internal server error';
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.errorCode || 'INTERNAL_ERROR',
      message,
      ...(err.errors && { details: err.errors }),
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId: req.id
    }
  });
}
```

## 8. Security Measures

### 8.1 Security Headers
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 8.2 Input Sanitization
- Validate all input data
- Sanitize HTML content
- Use parameterized queries
- Escape special characters

### 8.3 API Security Checklist
- [ ] HTTPS only
- [ ] Authentication required for sensitive endpoints
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Security headers configured
- [ ] Sensitive data encryption
- [ ] Audit logging enabled
- [ ] Regular security updates

## 9. Performance Optimization

### 9.1 Caching Strategy

#### Redis Caching
```javascript
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      redis.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

### 9.2 Database Optimization
- Index frequently queried columns
- Use database connection pooling
- Implement query result caching
- Optimize N+1 queries with eager loading
- Use database views for complex queries

### 9.3 API Performance Best Practices
- Implement pagination for list endpoints
- Use compression (gzip)
- Minimize response payload size
- Implement field filtering
- Use HTTP caching headers
- Enable keep-alive connections

## 10. Monitoring and Logging

### 10.1 Logging Strategy

#### Log Levels
- **ERROR**: Application errors, exceptions
- **WARN**: Warning conditions, deprecated API usage
- **INFO**: General information, request/response
- **DEBUG**: Detailed debugging information

#### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "API request completed",
  "metadata": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "method": "GET",
    "path": "/v1/products",
    "statusCode": 200,
    "duration": 125,
    "userId": "123",
    "ip": "192.168.1.1"
  }
}
```

### 10.2 Metrics Collection
- Request rate
- Response time
- Error rate
- Database query time
- Cache hit rate
- Active connections
- Memory usage
- CPU usage

### 10.3 Health Checks
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  });
});

app.get('/health/detailed', authenticate, authorize('admin'), async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();
  
  res.json({
    status: 'healthy',
    services: {
      database: dbHealth,
      redis: redisHealth
    },
    metrics: await getApplicationMetrics()
  });
});
```

## 11. Testing Strategy

### 11.1 Test Types
- **Unit Tests**: Individual functions and methods
- **Integration Tests**: API endpoints with database
- **E2E Tests**: Complete user workflows
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability scanning

### 11.2 Test Structure
```javascript
describe('POST /v1/auth/login', () => {
  it('should return JWT token for valid credentials', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data.accessToken');
    expect(response.body).toHaveProperty('data.refreshToken');
  });
  
  it('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
  });
});
```

## 12. Deployment Architecture

### 12.1 Environment Configuration
- **Development**: Local development with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Live environment with high availability

### 12.2 Infrastructure Components
```
┌─────────────────┐     ┌─────────────────┐
│   CloudFlare    │     │   Load Balancer │
│      (CDN)      │     │   (NGINX/ALB)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────┴─────┐          ┌─────┴────┐
    │  Node.js │          │  Node.js │
    │ Instance │          │ Instance │
    └────┬─────┘          └─────┬────┘
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────┴──────┐      ┌──────┴────┐
    │PostgreSQL │      │   Redis   │
    │  Primary  │      │   Cache   │
    └───────────┘      └───────────┘
```

### 12.3 Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Rollback procedure documented
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team notified

## 13. API Documentation

### 13.1 OpenAPI Specification
```yaml
openapi: 3.0.0
info:
  title: REST API
  version: 1.0.0
  description: Comprehensive REST API with authentication and resource management
servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server
```

### 13.2 Documentation Requirements
- Endpoint descriptions
- Request/response examples
- Authentication requirements
- Error response formats
- Rate limiting information
- Changelog and versioning

## 14. Future Considerations

### 14.1 Planned Enhancements
- GraphQL support alongside REST
- WebSocket support for real-time features
- Event-driven architecture with message queues
- Microservices migration path
- API Gateway implementation
- Service mesh adoption

### 14.2 Scalability Roadmap
- Horizontal scaling with container orchestration
- Database sharding strategy
- Global CDN deployment
- Multi-region failover
- Async job processing
- Event sourcing for audit trail

---

This architecture provides a solid foundation for building a scalable, secure, and maintainable REST API. Regular reviews and updates should be conducted to ensure the architecture continues to meet business requirements and technical best practices.