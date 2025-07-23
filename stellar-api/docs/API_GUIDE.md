# Stellar API Usage Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Making Requests](#making-requests)
4. [Error Handling](#error-handling)
5. [Code Examples](#code-examples)
6. [Best Practices](#best-practices)
7. [Rate Limiting](#rate-limiting)
8. [Security](#security)

## Quick Start

### Base URL
```
Development: http://localhost:3000/api/v1
Production: https://api.stellar-api.com/v1
```

### Required Headers
```http
Content-Type: application/json
Authorization: Bearer <your-jwt-token>
```

## Authentication

### 1. Register a New Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePassword123!",
    "profile": {
      "firstName": "John",
      "lastName": "Doe"
    }
  }'
```

**Response:**
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

### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "john@example.com",
    "password": "SecurePassword123!",
    "rememberMe": true
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "john@example.com"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### 3. Refresh Access Token

When your access token expires, use the refresh token to get a new one:

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## Making Requests

### Protected Endpoints

Include the JWT token in the Authorization header:

```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Update Profile

```bash
curl -X PUT http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "firstName": "John",
      "lastName": "Smith",
      "bio": "Full-stack developer",
      "phoneNumber": "+1-555-123-4567"
    }
  }'
```

### Upload Avatar

```bash
curl -X POST http://localhost:3000/api/v1/users/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/path/to/image.jpg"
```

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": "ValidationError",
  "message": "Invalid request parameters",
  "statusCode": 400,
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  }
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 423 | Locked | Account temporarily locked |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Code Examples

### JavaScript (Axios)

```javascript
const axios = require('axios');

// Configure axios instance
const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
let authToken = null;

api.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Login function
async function login(email, password) {
  try {
    const response = await api.post('/auth/login', {
      identifier: email,
      password: password
    });
    
    authToken = response.data.tokens.accessToken;
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response.data);
    throw error;
  }
}

// Get user profile
async function getProfile() {
  try {
    const response = await api.get('/users/profile');
    return response.data.user;
  } catch (error) {
    console.error('Failed to get profile:', error.response.data);
    throw error;
  }
}

// Update profile
async function updateProfile(updates) {
  try {
    const response = await api.put('/users/profile', updates);
    return response.data.user;
  } catch (error) {
    console.error('Failed to update profile:', error.response.data);
    throw error;
  }
}

// Usage
(async () => {
  try {
    await login('john@example.com', 'SecurePassword123!');
    
    const profile = await getProfile();
    console.log('Current profile:', profile);
    
    const updatedProfile = await updateProfile({
      profile: {
        bio: 'Updated bio'
      }
    });
    console.log('Updated profile:', updatedProfile);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
```

### Python (Requests)

```python
import requests
import json

class StellarAPI:
    def __init__(self, base_url='http://localhost:3000/api/v1'):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.auth_token = None
    
    def _request(self, method, endpoint, **kwargs):
        """Make authenticated requests"""
        if self.auth_token:
            self.session.headers['Authorization'] = f'Bearer {self.auth_token}'
        
        response = self.session.request(
            method,
            f'{self.base_url}{endpoint}',
            **kwargs
        )
        
        if response.status_code >= 400:
            print(f'Error: {response.json()}')
            response.raise_for_status()
        
        return response.json()
    
    def login(self, email, password):
        """Login and store auth token"""
        data = self._request('POST', '/auth/login', json={
            'identifier': email,
            'password': password
        })
        
        self.auth_token = data['tokens']['accessToken']
        return data
    
    def get_profile(self):
        """Get current user profile"""
        return self._request('GET', '/users/profile')
    
    def update_profile(self, updates):
        """Update user profile"""
        return self._request('PUT', '/users/profile', json=updates)
    
    def upload_avatar(self, image_path):
        """Upload avatar image"""
        # Temporarily remove Content-Type for multipart
        del self.session.headers['Content-Type']
        
        with open(image_path, 'rb') as f:
            files = {'avatar': f}
            response = self._request('POST', '/users/avatar', files=files)
        
        # Restore Content-Type
        self.session.headers['Content-Type'] = 'application/json'
        return response

# Usage
api = StellarAPI()

try:
    # Login
    login_data = api.login('john@example.com', 'SecurePassword123!')
    print(f"Logged in as: {login_data['user']['username']}")
    
    # Get profile
    profile = api.get_profile()
    print(f"Current profile: {profile}")
    
    # Update profile
    updated = api.update_profile({
        'profile': {
            'bio': 'Python developer'
        }
    })
    print(f"Updated profile: {updated}")
    
except requests.exceptions.HTTPError as e:
    print(f"HTTP Error: {e}")
except Exception as e:
    print(f"Error: {e}")
```

### PHP

```php
<?php

class StellarAPI {
    private $baseUrl;
    private $authToken;
    
    public function __construct($baseUrl = 'http://localhost:3000/api/v1') {
        $this->baseUrl = $baseUrl;
        $this->authToken = null;
    }
    
    private function request($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;
        
        $headers = [
            'Content-Type: application/json'
        ];
        
        if ($this->authToken) {
            $headers[] = 'Authorization: Bearer ' . $this->authToken;
        }
        
        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method
        ];
        
        if ($data) {
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }
        
        $ch = curl_init();
        curl_setopt_array($ch, $options);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $result = json_decode($response, true);
        
        if ($httpCode >= 400) {
            throw new Exception('API Error: ' . $result['message']);
        }
        
        return $result;
    }
    
    public function login($email, $password) {
        $data = $this->request('POST', '/auth/login', [
            'identifier' => $email,
            'password' => $password
        ]);
        
        $this->authToken = $data['tokens']['accessToken'];
        return $data;
    }
    
    public function getProfile() {
        return $this->request('GET', '/users/profile');
    }
    
    public function updateProfile($updates) {
        return $this->request('PUT', '/users/profile', $updates);
    }
}

// Usage
try {
    $api = new StellarAPI();
    
    // Login
    $loginData = $api->login('john@example.com', 'SecurePassword123!');
    echo "Logged in as: " . $loginData['user']['username'] . "\n";
    
    // Get profile
    $profile = $api->getProfile();
    echo "Current profile: " . json_encode($profile) . "\n";
    
    // Update profile
    $updated = $api->updateProfile([
        'profile' => [
            'bio' => 'PHP developer'
        ]
    ]);
    echo "Updated profile: " . json_encode($updated) . "\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

### Ruby

```ruby
require 'net/http'
require 'json'
require 'uri'

class StellarAPI
  def initialize(base_url = 'http://localhost:3000/api/v1')
    @base_url = base_url
    @auth_token = nil
  end
  
  def request(method, endpoint, data = nil)
    uri = URI("#{@base_url}#{endpoint}")
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == 'https'
    
    request = case method
    when :get
      Net::HTTP::Get.new(uri)
    when :post
      Net::HTTP::Post.new(uri)
    when :put
      Net::HTTP::Put.new(uri)
    when :delete
      Net::HTTP::Delete.new(uri)
    end
    
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{@auth_token}" if @auth_token
    request.body = data.to_json if data
    
    response = http.request(request)
    result = JSON.parse(response.body)
    
    if response.code.to_i >= 400
      raise "API Error: #{result['message']}"
    end
    
    result
  end
  
  def login(email, password)
    data = request(:post, '/auth/login', {
      identifier: email,
      password: password
    })
    
    @auth_token = data['tokens']['accessToken']
    data
  end
  
  def get_profile
    request(:get, '/users/profile')
  end
  
  def update_profile(updates)
    request(:put, '/users/profile', updates)
  end
end

# Usage
begin
  api = StellarAPI.new
  
  # Login
  login_data = api.login('john@example.com', 'SecurePassword123!')
  puts "Logged in as: #{login_data['user']['username']}"
  
  # Get profile
  profile = api.get_profile
  puts "Current profile: #{profile}"
  
  # Update profile
  updated = api.update_profile({
    profile: {
      bio: 'Ruby developer'
    }
  })
  puts "Updated profile: #{updated}"
  
rescue => e
  puts "Error: #{e.message}"
end
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

type StellarAPI struct {
    BaseURL   string
    AuthToken string
    Client    *http.Client
}

type LoginRequest struct {
    Identifier string `json:"identifier"`
    Password   string `json:"password"`
}

type LoginResponse struct {
    Success bool `json:"success"`
    User    User `json:"user"`
    Tokens  struct {
        AccessToken  string `json:"accessToken"`
        RefreshToken string `json:"refreshToken"`
        ExpiresIn    int    `json:"expiresIn"`
    } `json:"tokens"`
}

type User struct {
    ID       string `json:"_id"`
    Username string `json:"username"`
    Email    string `json:"email"`
    Profile  struct {
        FirstName string `json:"firstName"`
        LastName  string `json:"lastName"`
        Bio       string `json:"bio"`
    } `json:"profile"`
}

func NewStellarAPI(baseURL string) *StellarAPI {
    return &StellarAPI{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

func (api *StellarAPI) Request(method, endpoint string, data interface{}) ([]byte, error) {
    url := api.BaseURL + endpoint
    
    var body []byte
    var err error
    
    if data != nil {
        body, err = json.Marshal(data)
        if err != nil {
            return nil, err
        }
    }
    
    req, err := http.NewRequest(method, url, bytes.NewBuffer(body))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Content-Type", "application/json")
    if api.AuthToken != "" {
        req.Header.Set("Authorization", "Bearer "+api.AuthToken)
    }
    
    resp, err := api.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    responseBody, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("API error: %s", string(responseBody))
    }
    
    return responseBody, nil
}

func (api *StellarAPI) Login(email, password string) (*LoginResponse, error) {
    loginReq := LoginRequest{
        Identifier: email,
        Password:   password,
    }
    
    resp, err := api.Request("POST", "/auth/login", loginReq)
    if err != nil {
        return nil, err
    }
    
    var loginResp LoginResponse
    err = json.Unmarshal(resp, &loginResp)
    if err != nil {
        return nil, err
    }
    
    api.AuthToken = loginResp.Tokens.AccessToken
    return &loginResp, nil
}

func (api *StellarAPI) GetProfile() (*User, error) {
    resp, err := api.Request("GET", "/users/profile", nil)
    if err != nil {
        return nil, err
    }
    
    var result struct {
        Success bool `json:"success"`
        User    User `json:"user"`
    }
    
    err = json.Unmarshal(resp, &result)
    if err != nil {
        return nil, err
    }
    
    return &result.User, nil
}

func main() {
    api := NewStellarAPI("http://localhost:3000/api/v1")
    
    // Login
    loginResp, err := api.Login("john@example.com", "SecurePassword123!")
    if err != nil {
        fmt.Printf("Login error: %v\n", err)
        return
    }
    
    fmt.Printf("Logged in as: %s\n", loginResp.User.Username)
    
    // Get profile
    profile, err := api.GetProfile()
    if err != nil {
        fmt.Printf("Get profile error: %v\n", err)
        return
    }
    
    fmt.Printf("Profile: %+v\n", profile)
}
```

## Best Practices

### 1. Token Management

- Store tokens securely (never in plain text)
- Implement automatic token refresh
- Clear tokens on logout
- Use short-lived access tokens (1 hour)
- Use longer-lived refresh tokens (7-30 days)

### 2. Error Handling

- Always check response status codes
- Implement retry logic for network errors
- Handle rate limiting gracefully
- Log errors for debugging

### 3. Security

- Always use HTTPS in production
- Validate SSL certificates
- Don't expose sensitive data in URLs
- Implement request signing for critical operations
- Use strong passwords (min 8 chars, mixed case, numbers, symbols)

### 4. Performance

- Implement request caching where appropriate
- Use pagination for list endpoints
- Compress request/response bodies
- Batch operations when possible

## Rate Limiting

The API implements rate limiting to prevent abuse:

### Default Limits

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **Password reset**: 3 requests per hour
- **File uploads**: 20 requests per hour

### Rate Limit Headers

Each response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
Retry-After: 900
```

### Handling Rate Limits

When rate limited, you'll receive a 429 response:

```json
{
  "error": "TooManyRequests",
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

Implement exponential backoff:

```javascript
async function makeRequestWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Security

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Security

- Email verification required
- Account lockout after 5 failed login attempts
- Password reset tokens expire after 1 hour
- Two-factor authentication support (coming soon)

### API Security Features

- JWT token expiration
- Token refresh mechanism
- Request signing for sensitive operations
- IP-based rate limiting
- CORS configuration
- Security headers (Helmet.js)

## Webhooks (Coming Soon)

The API will support webhooks for real-time notifications:

- User registration
- Password changes
- Account deletions
- Profile updates

## Support

For API support, please contact:
- Email: dev@stellar-api.com
- Documentation: https://docs.stellar-api.com
- Status Page: https://status.stellar-api.com