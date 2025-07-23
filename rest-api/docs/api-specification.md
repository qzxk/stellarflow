# API Specification

## Overview
This document provides detailed specifications for all API endpoints defined in the architecture.

## Base Configuration
- **Base URL**: `https://api.example.com/v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer token (JWT)

## Authentication Endpoints

### Register User
```http
POST /v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "jwt.access.token",
      "refreshToken": "jwt.refresh.token",
      "expiresIn": 900
    }
  }
}
```

### Login
```http
POST /v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": ["user"]
    },
    "tokens": {
      "accessToken": "jwt.access.token",
      "refreshToken": "jwt.refresh.token",
      "expiresIn": 900
    }
  }
}
```

## Product Endpoints

### List Products
```http
GET /v1/products?page=1&perPage=20&category=electronics&sort=-price
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `perPage` (integer): Items per page (default: 20, max: 100)
- `category` (string): Filter by category
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `search` (string): Search in name and description
- `sort` (string): Sort field with - prefix for descending

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "product",
      "attributes": {
        "name": "Laptop Pro",
        "description": "High-performance laptop",
        "price": 1299.99,
        "category": "electronics",
        "sku": "LAP-001",
        "stockQuantity": 50,
        "images": [
          "https://cdn.example.com/products/lap-001-1.jpg"
        ]
      },
      "relationships": {
        "reviews": {
          "links": {
            "self": "/v1/products/uuid/reviews"
          },
          "meta": {
            "count": 25,
            "averageRating": 4.5
          }
        }
      }
    }
  ],
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
    "next": "/v1/products?page=2&perPage=20"
  }
}
```

### Create Product
```http
POST /v1/products
Authorization: Bearer <admin-token>
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 99.99,
  "category": "electronics",
  "sku": "PRD-001",
  "stockQuantity": 100,
  "images": ["url1", "url2"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "product",
    "attributes": {
      "name": "New Product",
      "description": "Product description",
      "price": 99.99,
      "category": "electronics",
      "sku": "PRD-001",
      "stockQuantity": 100,
      "images": ["url1", "url2"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Error Responses

### Validation Error (422)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/v1/auth/register",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired token",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/v1/products",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Rate Limit Exceeded (429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 300,
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/v1/auth/login",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Request/Response Headers

### Request Headers
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt-token>
X-Request-ID: <uuid>
X-API-Version: 1.0.0
Accept-Language: en-US
```

### Response Headers
```http
Content-Type: application/json
X-Request-ID: <uuid>
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642339200
X-Response-Time: 125ms
```

## Webhooks

### Event Types
- `user.created`
- `user.updated`
- `user.deleted`
- `product.created`
- `product.updated`
- `product.deleted`
- `order.created`
- `order.status.changed`

### Webhook Payload
```json
{
  "id": "evt_uuid",
  "type": "product.created",
  "created": "2024-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "prod_uuid",
      "name": "New Product",
      "price": 99.99
    }
  },
  "signature": "sha256=..."
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const api = new APIClient({
  baseURL: 'https://api.example.com/v1',
  apiKey: process.env.API_KEY
});

// List products
const products = await api.products.list({
  page: 1,
  perPage: 20,
  category: 'electronics'
});

// Create product
const product = await api.products.create({
  name: 'New Product',
  price: 99.99,
  category: 'electronics'
});
```

### Python
```python
from api_client import APIClient

client = APIClient(
    base_url='https://api.example.com/v1',
    api_key=os.environ['API_KEY']
)

# List products
products = client.products.list(
    page=1,
    per_page=20,
    category='electronics'
)

# Create product
product = client.products.create(
    name='New Product',
    price=99.99,
    category='electronics'
)
```

## Testing

### Test Environments
- **Development**: `http://localhost:3000/v1`
- **Staging**: `https://staging-api.example.com/v1`
- **Production**: `https://api.example.com/v1`

### Test Credentials
```json
{
  "testUser": {
    "email": "test@example.com",
    "password": "TestPassword123!"
  },
  "testAdmin": {
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  }
}
```