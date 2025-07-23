import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { Database } from '../config/database.js';
import User from '../models/User.js';
import { securityUtils } from '../utils/security.js';

// Test database setup
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

describe('Authentication System', () => {
  let server;
  let testUser;
  let authTokens;

  beforeAll(async () => {
    // Initialize test database
    await Database.initialize();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    await Database.close();
    server.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await Database.run('DELETE FROM users');
    await Database.run('DELETE FROM refresh_tokens');
    await Database.run('DELETE FROM login_attempts');
    await Database.run('DELETE FROM security_logs');
    
    // Create test user
    testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123!',
      first_name: 'Test',
      last_name: 'User'
    };
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should reject weak passwords', async () => {
      const weakPasswordUser = {
        ...testUser,
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should reject duplicate email addresses', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register with same email
      const duplicateUser = {
        ...testUser,
        username: 'differentuser'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'User with this email already exists');
    });

    test('should reject duplicate usernames', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register with same username
      const duplicateUser = {
        ...testUser,
        email: 'different@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Username is already taken');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      authTokens = response.body.tokens;
    });

    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    test('should implement account lockout after multiple failed attempts', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          });
      }

      // 6th attempt should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(423);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Account temporarily locked');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      authTokens = loginResponse.body.tokens;
    });

    test('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: authTokens.refreshToken
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Token refreshed successfully');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      
      // New tokens should be different from old ones
      expect(response.body.tokens.accessToken).not.toBe(authTokens.accessToken);
      expect(response.body.tokens.refreshToken).not.toBe(authTokens.refreshToken);
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid or expired refresh token');
    });

    test('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Protected Routes', () => {
    let accessToken;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No token provided');
    });

    test('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token format.');
    });

    test('should reject expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 1, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        process.env.JWT_SECRET
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Token expired.');
    });
  });

  describe('Password Change', () => {
    let accessToken;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    test('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPass123!'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password changed successfully');

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPass123!'
        })
        .expect(200);
    });

    test('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'NewPass123!'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Current password is incorrect');
    });

    test('should reject weak new password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: '123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Logout', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      accessToken = loginResponse.body.tokens.accessToken;
      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout successful');

      // Verify refresh token is invalidated
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('Security Features', () => {
    test('should generate secure device fingerprints', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: (header) => {
          const headers = {
            'User-Agent': 'Test Browser',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip'
          };
          return headers[header];
        }
      };

      const fingerprint1 = securityUtils.generateDeviceFingerprint(mockReq);
      const fingerprint2 = securityUtils.generateDeviceFingerprint(mockReq);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA-256 hex string
    });

    test('should validate password strength', () => {
      const weakPassword = securityUtils.validatePasswordStrength('123');
      expect(weakPassword.valid).toBe(false);
      expect(weakPassword.strength).toBe('weak');

      const strongPassword = securityUtils.validatePasswordStrength('StrongPass123!');
      expect(strongPassword.valid).toBe(true);
      expect(strongPassword.strength).toBe('strong');
    });

    test('should sanitize user input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = securityUtils.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on auth endpoints', async () => {
      // Make multiple rapid requests to trigger rate limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
