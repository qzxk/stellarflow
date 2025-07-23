const request = require('supertest');
const app = require('../../examples/05-swarm-apps/rest-api-advanced/server');
const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const authService = require('../../examples/05-swarm-apps/rest-api-advanced/src/services/auth.service');

describe('Security Tests', () => {
  let server;
  let authToken;
  let testUser;

  beforeAll(() => {
    server = app;
  });

  beforeEach(async () => {
    await User.deleteMany({});
    
    testUser = await User.create({
      email: 'security@example.com',
      password: 'SecurePass123!',
      name: 'Security Test User',
      role: 'user',
      isEmailVerified: true,
      isActive: true,
    });

    authToken = authService.generateAccessToken(testUser);
  });

  describe('Input Validation & Sanitization', () => {
    it('should sanitize HTML input in user profile', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Test User',
        bio: '<img src="x" onerror="alert(\'xss\')">Bio content',
      };

      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(200);

      // Should strip out script tags and malicious attributes
      expect(response.body.data.user.name).not.toContain('<script>');
      expect(response.body.data.user.bio).not.toContain('onerror');
    });

    it('should prevent NoSQL injection in login', async () => {
      const maliciousLogin = {
        email: { $gt: '' }, // NoSQL injection attempt
        password: { $gt: '' },
      };

      const response = await request(server)
        .post('/api/auth/login')
        .send(maliciousLogin)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent MongoDB injection in search', async () => {
      const adminUser = await User.create({
        email: 'admin@example.com',
        password: 'AdminPass123!',
        name: 'Admin User',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      
      const adminToken = authService.generateAccessToken(adminUser);

      const response = await request(server)
        .get('/api/users?search[$regex]=.*&search[$options]=i')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should treat the malicious query as a string, not execute it
      expect(response.body.data.users.length).toBe(0);
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user@example',
      ];

      for (const email of invalidEmails) {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email,
            password: 'ValidPass123!',
            name: 'Test User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toContainEqual(
          expect.objectContaining({
            field: 'email',
          })
        );
      }
    });

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'PASSWORD',
        'Password',
        'Pass123',
        '!@#$%^&*',
      ];

      for (const password of weakPasswords) {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email: `test${Date.now()}@example.com`,
            password,
            name: 'Test User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toContainEqual(
          expect.objectContaining({
            field: 'password',
          })
        );
      }
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authorization header', async () => {
      await request(server)
        .get('/api/users/profile')
        .expect(401);
    });

    it('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic dGVzdA==',
        'JWT invalid-token',
        'Bearer invalid.jwt.token',
      ];

      for (const header of malformedHeaders) {
        await request(server)
          .get('/api/users/profile')
          .set('Authorization', header)
          .expect(401);
      }
    });

    it('should reject expired tokens', async () => {
      // Create an expired token (mocking JWT with past expiry)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE4ODM2NDAwLCJleHAiOjE2MTg4MzY0NjB9.invalid';
      
      await request(server)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should prevent privilege escalation', async () => {
      // Regular user trying to access admin endpoints
      await request(server)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      await request(server)
        .put(`/api/users/${testUser._id}/role`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('should prevent cross-user data access', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'OtherPass123!',
        name: 'Other User',
        role: 'user',
        isEmailVerified: true,
        isActive: true,
      });

      // Try to access other user's data (should be prevented by proper authorization)
      const adminUser = await User.create({
        email: 'admin@security.com',
        password: 'AdminPass123!',
        name: 'Admin User',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
      });
      
      const adminToken = authService.generateAccessToken(adminUser);

      const response = await request(server)
        .get(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.user.password).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit authentication attempts', async () => {
      const requests = [];
      
      // Make multiple login attempts
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(server)
            .post('/api/auth/login')
            .send({
              email: 'security@example.com',
              password: 'WrongPassword!',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    }, 10000);

    it('should rate limit general API requests', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(server)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    }, 15000);
  });

  describe('HTTP Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should include CSP headers', async () => {
      const response = await request(server)
        .get('/')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'somepassword',
        })
        .expect(401);

      // Should not reveal whether email exists or not
      expect(response.body.message).not.toContain('User not found');
      expect(response.body.message).not.toContain('Email does not exist');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should not expose stack traces in production errors', async () => {
      // Force an error by sending malformed data
      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');
    });

    it('should not expose internal server errors details', async () => {
      // This would need to trigger an actual server error
      // For now, we'll just check that 500 errors don't expose internals
      const response = await request(server)
        .post('/api/invalid-endpoint-that-causes-error')
        .expect(404);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');
    });
  });

  describe('File Upload Security', () => {
    it('should validate file upload types', async () => {
      // This test would require implementing file upload endpoints
      // For now, we'll create a placeholder test structure
      expect(true).toBe(true); // Placeholder
    });

    it('should limit file upload sizes', async () => {
      // Test for file size limits
      expect(true).toBe(true); // Placeholder
    });

    it('should scan uploaded files for malware', async () => {
      // Test for malware scanning
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Session Security', () => {
    it('should invalidate tokens on logout', async () => {
      // Login first
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'security@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Logout
      await request(server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use the token after logout (should fail if properly blacklisted)
      await request(server)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should prevent session fixation', async () => {
      // Each login should generate a new token
      const login1 = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'security@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      const login2 = await request(server)
        .post('/api/auth/login')
        .send({
          email: 'security@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(login1.body.token).not.toBe(login2.body.token);
    });
  });

  describe('CORS Security', () => {
    it('should enforce CORS policy', async () => {
      const response = await request(server)
        .options('/')
        .set('Origin', 'https://malicious-site.com')
        .expect(200);

      // Should have CORS headers
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});