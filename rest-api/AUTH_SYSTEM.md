# StellarFlow Authentication System

## Overview

A comprehensive, production-ready authentication system with advanced security features including JWT tokens, refresh token rotation, account lockout protection, rate limiting, and suspicious activity detection.

## 🔐 Security Features

### Core Authentication
- **JWT Access Tokens**: Short-lived tokens (1 hour default) for API access
- **Refresh Token Rotation**: Secure token refresh with automatic rotation
- **Password Hashing**: bcrypt with configurable rounds (12 default)
- **User Roles**: Role-based access control (user, admin)
- **Account Status**: Active/inactive user management

### Advanced Security
- **Account Lockout**: Automatic lockout after 5 failed login attempts (30-minute lockout)
- **Rate Limiting**: Configurable rate limits on all auth endpoints
- **IP Blacklisting**: Automatic and manual IP blocking capabilities
- **Device Fingerprinting**: Track and identify suspicious login patterns
- **Security Event Logging**: Comprehensive audit trail of security events
- **Suspicious Activity Detection**: ML-based detection of unusual login patterns

### Additional Protections
- **Input Validation**: Comprehensive validation using Joi schemas
- **SQL Injection Protection**: Parameterized queries throughout
- **XSS Protection**: Input sanitization and CSP headers
- **CSRF Protection**: Token-based CSRF prevention
- **Secure Headers**: Helmet.js security headers
- **Password Strength**: Enforced password complexity requirements

## 📁 File Structure

```
src/
├── middleware/
│   ├── auth.js              # JWT authentication middleware
│   ├── rateLimiter.js       # Rate limiting and account lockout
│   └── validation.js        # Input validation schemas
├── routes/
│   └── auth.js              # Authentication endpoints
├── models/
│   └── User.js              # User model with security methods
├── utils/
│   └── security.js          # Security utilities and helpers
├── config/
│   └── database.js          # Database configuration
└── tests/
    └── auth.test.js         # Comprehensive test suite
```

## 🛠 API Endpoints

### Public Endpoints

#### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "bio": "Optional bio"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user",
    "is_active": true,
    "created_at": "2023-07-23T10:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "1h"
  }
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": { /* user object */ },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "1h"
  }
}
```

#### Token Refresh
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Protected Endpoints

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PUT /api/auth/me
Authorization: Bearer <access_token>
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
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## 🔧 Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database
DB_PATH=./data/stellarflow.db

# CORS
CORS_ORIGIN=http://localhost:3000

# Admin User (Optional)
ADMIN_EMAIL=admin@stellarflow.com
ADMIN_PASSWORD=admin123
```

### Rate Limiting Configuration

- **Auth Endpoints**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **Password Reset**: 3 attempts per hour
- **General API**: 100 requests per 15 minutes
- **Account Lockout**: 5 failed attempts = 30-minute lockout

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

Test coverage includes:
- User registration validation
- Login/logout functionality
- Token generation and validation
- Refresh token rotation
- Account lockout mechanisms
- Rate limiting enforcement
- Password change security
- Input validation and sanitization
- Security event logging

## 🚀 Setup and Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Setup Script**
   ```bash
   node scripts/setup.js
   ```
   This will:
   - Create necessary directories
   - Initialize the database
   - Set up security tables
   - Create admin user (if configured)
   - Generate .env file from template

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Start Production Server**
   ```bash
   npm start
   ```

## 🔒 Security Best Practices

### Password Requirements
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Must contain special character (@$!%*?&)
- Cannot contain common patterns (123456, password, etc.)

### Token Security
- Access tokens are short-lived (1 hour)
- Refresh tokens automatically rotate on use
- Tokens include issuer and audience validation
- Unique token IDs (jti) for tracking
- Secure token storage in database

### Account Protection
- Automatic lockout after failed attempts
- IP-based rate limiting
- Device fingerprinting for suspicious activity
- Comprehensive security event logging
- Optional IP whitelisting/blacklisting

### Database Security
- All queries use parameterized statements
- Password hashes use bcrypt with salt
- Soft delete for user accounts
- Foreign key constraints for data integrity
- Indexed columns for performance

## 📊 Monitoring and Logging

### Security Events Logged
- Failed login attempts
- Account lockouts
- Suspicious activity detection
- Token verification failures
- IP blocking events
- Password changes
- Account modifications

### Log Retention
- Security logs: 90 days
- Login history: 30 days
- Failed attempts: 30 minutes (auto-cleanup)
- IP blacklist: Configurable expiration

## 🔄 Maintenance

### Automatic Cleanup
- Expired refresh tokens removed daily
- Old security logs cleaned after 90 days
- Failed login attempts expire after 30 minutes
- IP blacklist entries expire based on configuration

### Manual Maintenance
- Review security logs regularly
- Monitor rate limiting effectiveness
- Update password policies as needed
- Rotate JWT secrets periodically

## 🚨 Error Handling

### Common Error Responses

**Validation Error (400)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter",
      "value": "provided_value"
    }
  ]
}
```

**Authentication Error (401)**
```json
{
  "error": "Invalid credentials"
}
```

**Account Locked (423)**
```json
{
  "error": "Account temporarily locked due to too many failed login attempts",
  "timeRemaining": 25,
  "attempts": 5
}
```

**Rate Limited (429)**
```json
{
  "error": "Too many authentication attempts, please try again later.",
  "retryAfter": 900
}
```

## 🔧 Customization

### Adding Custom Validation
```javascript
// In middleware/validation.js
export const schemas = {
  customSchema: Joi.object({
    // Your custom validation rules
  })
};
```

### Custom Security Events
```javascript
// In your route handler
import { securityUtils } from '../utils/security.js';

await securityUtils.logSecurityEvent({
  type: 'custom_event',
  severity: 'warning',
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  userId: req.user?.id,
  details: { custom: 'data' }
});
```

### Custom Rate Limiters
```javascript
// In middleware/rateLimiter.js
export const customLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Custom rate limit exceeded'
});
```

## 📝 License

This authentication system is part of the StellarFlow project. See the main project license for details.
