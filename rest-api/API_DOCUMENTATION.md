# REST API Documentation

## Overview

This is a comprehensive REST API built with Express.js featuring authentication, authorization, and CRUD operations for products. The API includes security best practices, input validation, rate limiting, and proper error handling.

## Features

- **JWT Authentication** with access and refresh tokens
- **Role-based authorization** (admin, manager, user)
- **Comprehensive input validation** using Joi
- **Security features**: Helmet, CORS, rate limiting, SQL injection protection
- **Structured error handling** with proper HTTP status codes
- **Request logging** with Morgan and Winston
- **Database migrations** and seeding
- **Performance optimizations**: compression, connection pooling
- **API versioning** (/api/v1/)

## Installation

```bash
# Navigate to the REST API directory
cd rest-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Seed the database (optional)
node scripts/seedProducts.js

# Start the server
npm run dev  # Development with nodemon
npm start    # Production
```

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access-token>
```

#### Update Profile
```http
PUT /api/auth/me
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Smith",
  "bio": "Updated bio"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

### Product Endpoints

#### Get All Products
```http
GET /api/v1/products?page=1&limit=10&sort_by=price&sort_order=asc
```

Query Parameters:
- `page` (default: 1) - Page number
- `limit` (default: 10) - Items per page
- `category_id` - Filter by category
- `min_price` - Minimum price filter
- `max_price` - Maximum price filter
- `search` - Search in name, description, SKU
- `sort_by` - Sort field (name, price, created_at, updated_at, stock_quantity)
- `sort_order` - Sort direction (asc, desc)
- `is_active` - Filter by active status
- `in_stock_only` - Show only in-stock products

#### Get Product by ID
```http
GET /api/v1/products/:id
```

#### Create Product (Admin/Manager only)
```http
POST /api/v1/products
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "Wireless Mouse",
  "description": "High precision wireless mouse",
  "price": 29.99,
  "stock_quantity": 100,
  "sku": "WM001",
  "category_id": 1,
  "image_url": "https://example.com/mouse.jpg",
  "weight": 0.1,
  "dimensions": "10x6x4 cm"
}
```

#### Update Product (Admin/Manager/Creator)
```http
PUT /api/v1/products/:id
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": 39.99,
  "stock_quantity": 150
}
```

#### Update Stock
```http
PATCH /api/v1/products/:id/stock
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "quantity": 50,
  "operation": "increment"  // "set", "increment", "decrement"
}
```

#### Delete Product (Soft Delete)
```http
DELETE /api/v1/products/:id
Authorization: Bearer <access-token>
```

#### Permanent Delete (Admin only)
```http
DELETE /api/v1/products/:id/permanent
Authorization: Bearer <access-token>
```

#### Get Products by Category
```http
GET /api/v1/products/category/:categoryId
```

#### Get Low Stock Products (Admin/Manager)
```http
GET /api/v1/products/low-stock?threshold=10
Authorization: Bearer <access-token>
```

#### Get Product Statistics
```http
GET /api/v1/products/statistics
Authorization: Bearer <access-token>
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Token Management

1. **Access Token**: Short-lived token (1 hour) for API access
2. **Refresh Token**: Long-lived token (7 days) for getting new access tokens

Include the access token in the Authorization header:
```
Authorization: Bearer <your-access-token>
```

### User Roles

- **user**: Default role, can view products
- **manager**: Can create and manage products
- **admin**: Full access to all endpoints

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "details": {
    "field": "Additional information"
  }
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

## Rate Limiting

- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Registration: 3 requests per hour

## Security Features

1. **Helmet.js** - Sets various HTTP headers
2. **CORS** - Configured for allowed origins
3. **Input Validation** - All inputs validated with Joi
4. **SQL Injection Protection** - Parameterized queries
5. **Password Security** - Bcrypt with salt rounds
6. **Rate Limiting** - Prevents brute force attacks
7. **Request Logging** - All requests logged
8. **IP Blocking** - Suspicious activity detection

## Database Schema

### Users Table
- id (PRIMARY KEY)
- username (UNIQUE)
- email (UNIQUE)
- password_hash
- first_name
- last_name
- role
- is_active
- created_at
- updated_at

### Products Table
- id (PRIMARY KEY)
- name
- description
- price
- stock_quantity
- category_id (FOREIGN KEY)
- created_by (FOREIGN KEY)
- sku (UNIQUE)
- image_url
- weight
- dimensions
- is_active
- created_at
- updated_at

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Environment Variables

Required environment variables in `.env`:

```env
# Server
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=1h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRE=7d

# Database
DATABASE_URL=./database.sqlite

# Security
BCRYPT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

## Development

### Project Structure
```
rest-api/
├── src/
│   ├── config/         # Database and app configuration
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Express middleware
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   ├── validators/     # Input validation schemas
│   └── server.js       # Express app setup
├── scripts/            # Database scripts
│   ├── migrations/     # Database migrations
│   ├── migrate.js      # Migration runner
│   └── seedProducts.js # Seed sample data
├── tests/              # Test files
├── logs/               # Application logs
└── package.json
```

### Adding New Endpoints

1. Create model in `src/models/`
2. Add validation schema in `src/middleware/validation.js`
3. Create routes in `src/routes/`
4. Add route to `src/server.js`
5. Create migration in `scripts/migrations/`
6. Run migration: `npm run migrate`

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure proper CORS origins
4. Set up SSL/TLS
5. Use a process manager (PM2)
6. Set up monitoring and logging
7. Configure firewall rules
8. Regular security updates

## License

MIT