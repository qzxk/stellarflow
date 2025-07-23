/**
 * Auth Endpoints Integration Tests
 * Tests complete authentication flow through API endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../examples/05-swarm-apps/rest-api-advanced/server');
const User = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const bcrypt = require('bcryptjs');

describe('Auth Endpoints Integration Tests', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});

    // Create test user
    testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User'
    };

    const hashedPassword = await bcrypt.hash(testUser.password, 12);
    const savedUser = await User.create({
      ...testUser,
      password: hashedPassword
    });

    testUser.id = savedUser._id;
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'NewPassword123!',
        name: 'New User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: newUser.email,
            name: newUser.name
          },
          token: expect.any(String)
        }
      });

      // Verify user was created in database
      const dbUser = await User.findOne({ email: newUser.email });
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(newUser.email);
      expect(dbUser.name).toBe(newUser.name);
    });

    it('should validate required fields', async () => {
      const invalidUser = {
        email: 'invalid-email',
        password: '123', // Too short
        name: '' // Empty name
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should prevent duplicate email registration', async () => {
      const duplicateUser = {
        email: testUser.email, // Same as existing user
        password: 'DifferentPassword123!',
        name: 'Different Name'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });

    it('should enforce password strength requirements', async () => {
      const weakPasswordUser = {
        email: 'weak@example.com',
        password: 'weak',
        name: 'Weak Password User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('password')
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: testUser.email,
            name: testUser.name
          },
          token: expect.any(String)
        }
      });

      // Store token for subsequent tests
      authToken = response.body.data.token;
    });

    it('should reject invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: testUser.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid credentials')
      });
    });

    it('should reject invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid credentials')
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email }) // Missing password
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.data.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            email: testUser.email,
            name: testUser.name
          }
        }
      });

      // Should not include password
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token')
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token')
      });
    });
  });

  describe('PUT /api/auth/profile', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.data.token;
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            name: updateData.name,
            email: updateData.email
          }
        }
      });

      // Verify update in database
      const dbUser = await User.findById(testUser.id);
      expect(dbUser.name).toBe(updateData.name);
      expect(dbUser.email).toBe(updateData.email);
    });

    it('should validate email format', async () => {
      const updateData = {
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('email')
      });
    });

    it('should prevent duplicate email', async () => {
      // Create another user
      await User.create({
        email: 'another@example.com',
        password: await bcrypt.hash('password123', 12),
        name: 'Another User'
      });

      const updateData = {
        email: 'another@example.com' // Try to use existing email
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('email')
      });
    });
  });

  describe('POST /api/auth/change-password', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.data.token;
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password')
      });

      // Test login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: passwordData.newPassword
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'wrongcurrentpassword',
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('current password')
      });
    });

    it('should validate password confirmation', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'DifferentPassword456!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('match')
      });
    });

    it('should enforce password strength for new password', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'weak',
        confirmPassword: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('password')
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.data.token;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('logout')
      });
    });

    it('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token')
      });
    });
  });
});