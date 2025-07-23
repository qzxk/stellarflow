# Authentication Documentation

## Overview

Stellar API uses JWT (JSON Web Tokens) for authentication with a dual-token system:
- **Access Token**: Short-lived token for API requests (1 hour)
- **Refresh Token**: Long-lived token for obtaining new access tokens (7-30 days)

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Database
    
    Client->>API: POST /auth/register
    API->>Database: Create user
    API->>Client: User created (email verification required)
    
    Client->>API: POST /auth/login
    API->>Database: Validate credentials
    API->>Client: Access + Refresh tokens
    
    Client->>API: GET /users/profile (with access token)
    API->>API: Validate JWT
    API->>Database: Get user data
    API->>Client: User profile
    
    Note over Client,API: When access token expires
    
    Client->>API: POST /auth/refresh (with refresh token)
    API->>Database: Validate refresh token
    API->>Client: New access token
```

## Registration Process

### 1. User Registration

**Endpoint**: `POST /api/v1/auth/register`

**Request Body**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Validation Rules**:
- Username: 3-30 characters, alphanumeric with underscores/hyphens
- Email: Valid email format
- Password: Minimum 8 characters, must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

**Response**:
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email to verify your account.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "emailVerified": false,
    "status": "pending",
    "role": "user"
  }
}
```

### 2. Email Verification

After registration, users receive an email with a verification link:

**Endpoint**: `GET /api/v1/auth/verify-email?token=<verification-token>`

**Success Response**:
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

To resend verification email:

**Endpoint**: `POST /api/v1/auth/resend-verification`

**Request**:
```json
{
  "email": "john@example.com"
}
```

## Login Process

### Standard Login

**Endpoint**: `POST /api/v1/auth/login`

**Request**:
```json
{
  "identifier": "john@example.com",  // Email or username
  "password": "SecurePassword123!",
  "rememberMe": true  // Optional: longer refresh token expiry
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "role": "user",
    "lastLogin": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### Account Security

- After 5 failed login attempts, the account is temporarily locked for 15 minutes
- Each failed attempt increments the counter
- Successful login resets the counter
- Locked accounts receive a 423 status code

## Token Management

### JWT Structure

**Access Token Payload**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "username": "johndoe",
  "email": "john@example.com",
  "role": "user",
  "iat": 1640995200,
  "exp": 1640998800,
  "iss": "stellar-api",
  "aud": "stellar-api-client"
}
```

### Using Tokens

Include the access token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh

When the access token expires, use the refresh token to get a new one:

**Endpoint**: `POST /api/v1/auth/refresh`

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### Token Storage Best Practices

**Web Applications**:
```javascript
// Store tokens securely
const tokenManager = {
  setTokens(tokens) {
    // Access token in memory only
    this.accessToken = tokens.accessToken;
    
    // Refresh token in httpOnly cookie (server-set) or secure storage
    if (tokens.refreshToken) {
      // For SPAs, consider using a secure, httpOnly cookie set by the server
      // For mobile/desktop apps, use secure storage
      secureStorage.setItem('refreshToken', tokens.refreshToken);
    }
  },
  
  getAccessToken() {
    return this.accessToken;
  },
  
  clearTokens() {
    this.accessToken = null;
    secureStorage.removeItem('refreshToken');
  }
};
```

**Mobile Applications**:
- iOS: Use Keychain Services
- Android: Use Android Keystore
- React Native: Use react-native-keychain or similar

### Automatic Token Refresh

Implement automatic token refresh to maintain user sessions:

```javascript
class AuthService {
  constructor(api) {
    this.api = api;
    this.refreshing = false;
    this.refreshSubscribers = [];
  }
  
  async makeAuthenticatedRequest(config) {
    try {
      return await this.api.request(config);
    } catch (error) {
      if (error.response?.status === 401) {
        if (!this.refreshing) {
          this.refreshing = true;
          
          try {
            const newTokens = await this.refreshAccessToken();
            this.onRefreshSuccess(newTokens.accessToken);
            
            // Retry original request
            config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
            return await this.api.request(config);
          } catch (refreshError) {
            this.onRefreshFailed();
            throw refreshError;
          } finally {
            this.refreshing = false;
          }
        }
        
        // Wait for ongoing refresh
        return new Promise((resolve, reject) => {
          this.refreshSubscribers.push((token) => {
            config.headers.Authorization = `Bearer ${token}`;
            resolve(this.api.request(config));
          });
        });
      }
      
      throw error;
    }
  }
  
  onRefreshSuccess(token) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }
  
  onRefreshFailed() {
    this.refreshSubscribers = [];
    // Redirect to login
  }
}
```

## Password Management

### Password Reset Flow

1. **Request Password Reset**

**Endpoint**: `POST /api/v1/auth/forgot-password`

**Request**:
```json
{
  "email": "john@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

2. **Reset Password**

**Endpoint**: `POST /api/v1/auth/reset-password`

**Request**:
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Change Password (Authenticated)

**Endpoint**: `POST /api/v1/users/change-password`

**Headers**:
```http
Authorization: Bearer <access-token>
```

**Request**:
```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

## Logout

**Endpoint**: `POST /api/v1/auth/logout`

**Headers**:
```http
Authorization: Bearer <access-token>
```

**Request** (optional):
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Logout Best Practices**:
1. Clear access token from memory
2. Invalidate refresh token on server
3. Clear any cached user data
4. Redirect to login page

## Security Considerations

### 1. HTTPS Only

Always use HTTPS in production to prevent token interception:

```javascript
// Enforce HTTPS
if (location.protocol !== 'https:' && !location.hostname.includes('localhost')) {
  location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
```

### 2. CSRF Protection

For web applications, implement CSRF protection:

```javascript
// Include CSRF token in requests
const csrfToken = getCsrfToken();
axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
```

### 3. Token Expiration Handling

Handle token expiration gracefully:

```javascript
// Check token expiration
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
}

// Proactive refresh
function scheduleTokenRefresh(expiresIn) {
  // Refresh 5 minutes before expiry
  const refreshTime = (expiresIn - 300) * 1000;
  
  setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Redirect to login
    }
  }, refreshTime);
}
```

### 4. Secure Storage

Never store sensitive tokens in:
- Local Storage (XSS vulnerable)
- Session Storage (XSS vulnerable)
- URL parameters
- Browser history

Recommended storage:
- Memory (for access tokens)
- HTTP-only cookies (for refresh tokens in web apps)
- Secure device storage (for mobile apps)

## Two-Factor Authentication (Coming Soon)

Future support for 2FA will include:
- TOTP (Time-based One-Time Passwords)
- SMS verification
- Backup codes
- Authenticator app integration

## OAuth Integration (Coming Soon)

Future OAuth support will include:
- Google OAuth
- GitHub OAuth
- Facebook OAuth
- Custom OAuth providers

## Session Management

### Active Sessions

Users can view and manage active sessions:

```javascript
// Get active sessions
GET /api/v1/auth/sessions

// Revoke specific session
DELETE /api/v1/auth/sessions/:sessionId

// Revoke all sessions except current
POST /api/v1/auth/sessions/revoke-others
```

### Session Security

- Sessions are tracked with device information
- Unusual login locations trigger security alerts
- Users can revoke sessions remotely

## Error Handling

### Common Authentication Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| 401 | Invalid or expired token | Refresh token or re-login |
| 403 | Insufficient permissions | Check user role/permissions |
| 423 | Account locked | Wait for lockout period |
| 429 | Too many attempts | Implement rate limiting |

### Error Response Format

```json
{
  "error": "AuthenticationError",
  "message": "Invalid credentials",
  "statusCode": 401,
  "details": {
    "field": "password",
    "attempts": 3,
    "remainingAttempts": 2
  }
}
```

## Testing Authentication

### Postman Collection

Import the Postman collection from `/postman/Stellar-API.postman_collection.json` for pre-configured authentication tests.

### Test Credentials

For development/testing:
```
Email: test@example.com
Password: TestPassword123!
```

### cURL Examples

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"TestPassword123!"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"TestPassword123!"}'

# Use access token
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer <access-token>"

# Refresh token
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

## Security Checklist

- [ ] Always use HTTPS in production
- [ ] Implement rate limiting on auth endpoints
- [ ] Store tokens securely
- [ ] Implement automatic token refresh
- [ ] Handle token expiration gracefully
- [ ] Clear tokens on logout
- [ ] Validate email addresses
- [ ] Enforce strong passwords
- [ ] Implement account lockout
- [ ] Log authentication events
- [ ] Monitor for suspicious activity
- [ ] Implement CSRF protection
- [ ] Use secure headers
- [ ] Regular security audits