const request = require('supertest');
const app = require('../../../examples/05-swarm-apps/rest-api-advanced/server');
const User = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const Token = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/token.model');
const authService = require('../../../examples/05-swarm-apps/rest-api-advanced/src/services/auth.service');
const { faker } = require('@faker-js/faker');

describe('User API Endpoints', () => {
  let server;
  let authToken;
  let adminToken;
  let testUser;
  let adminUser;

  beforeAll(() => {
    server = app;
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Token.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'testuser@example.com',
      password: 'Password123!',
      name: 'Test User',
      role: 'user',
      isEmailVerified: true,
      isActive: true,
    });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@example.com',
      password: 'AdminPass123!',
      name: 'Admin User',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    });

    // Generate auth tokens
    authToken = authService.generateAccessToken(testUser);
    adminToken = authService.generateAccessToken(adminUser);
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile successfully', async () => {
      const response = await request(server)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
      });
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      await request(server)
        .get('/api/users/profile')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(server)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '+1234567890',
        bio: 'Updated bio',
      };

      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.phone).toBe(updateData.phone);
      expect(response.body.data.user.bio).toBe(updateData.bio);

      // Verify in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.phone).toBe(updateData.phone);
    });

    it('should not update protected fields', async () => {
      const updateData = {
        email: 'newemail@example.com',
        role: 'admin',
        password: 'newpassword123',
      };

      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.role).toBe(testUser.role);

      // Verify in database
      const user = await User.findById(testUser._id);
      expect(user.email).toBe(testUser.email);
      expect(user.role).toBe(testUser.role);
    });

    it('should validate input data', async () => {
      const invalidData = {
        name: '', // Empty name
        phone: '123', // Invalid phone format
        email: 'invalid-email', // Invalid email (should be ignored)
      };

      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/users/change-password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword456!',
      };

      const response = await request(server)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('changed successfully');

      // Verify can login with new password
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword456!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword456!',
      };

      const response = await request(server)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });

    it('should validate password strength', async () => {
      const passwordData = {
        currentPassword: 'Password123!',
        newPassword: 'weak', // Too weak
      };

      const response = await request(server)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('DELETE /api/users/account', () => {
    it('should deactivate user account successfully', async () => {
      const response = await request(server)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deactivated');

      // Verify user is deactivated
      const user = await User.findById(testUser._id);
      expect(user.isActive).toBe(false);
      expect(user.deactivatedAt).toBeInstanceOf(Date);
    });

    it('should prevent login after account deactivation', async () => {
      await request(server)
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to login
      const loginResponse = await request(server)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'Password123!',
        })
        .expect(401);

      expect(loginResponse.body.success).toBe(false);
      expect(loginResponse.body.message).toContain('deactivated');
    });
  });

  describe('Admin-only endpoints', () => {
    describe('GET /api/users', () => {
      beforeEach(async () => {
        // Create additional test users
        await User.create([
          {
            email: 'user1@example.com',
            password: 'Password123!',
            name: 'User One',
            role: 'user',
          },
          {
            email: 'user2@example.com',
            password: 'Password123!',
            name: 'User Two',
            role: 'user',
          },
        ]);
      });

      it('should get users list for admin', async () => {
        const response = await request(server)
          .get('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.users).toBeInstanceOf(Array);
        expect(response.body.data.users.length).toBeGreaterThanOrEqual(2);
        expect(response.body.data.totalUsers).toBeGreaterThanOrEqual(2);
        expect(response.body.data.pagination).toBeDefined();
      });

      it('should support pagination', async () => {
        const response = await request(server)
          .get('/api/users?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data.users.length).toBeLessThanOrEqual(2);
        expect(response.body.data.pagination.currentPage).toBe(1);
        expect(response.body.data.pagination.limit).toBe(2);
      });

      it('should support search', async () => {
        const response = await request(server)
          .get('/api/users?search=User One')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.data.users.length).toBeGreaterThanOrEqual(1);
        expect(response.body.data.users[0].name).toContain('User One');
      });

      it('should reject non-admin access', async () => {
        await request(server)
          .get('/api/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('GET /api/users/:id', () => {
      it('should get user by id for admin', async () => {
        const response = await request(server)
          .get(`/api/users/${testUser._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toMatchObject({
          _id: testUser._id.toString(),
          email: testUser.email,
          name: testUser.name,
        });
      });

      it('should return 404 for non-existent user', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        await request(server)
          .get(`/api/users/${fakeId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should reject non-admin access', async () => {
        await request(server)
          .get(`/api/users/${testUser._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('PUT /api/users/:id/role', () => {
      it('should update user role for admin', async () => {
        const response = await request(server)
          .put(`/api/users/${testUser._id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'moderator' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe('moderator');

        // Verify in database
        const user = await User.findById(testUser._id);
        expect(user.role).toBe('moderator');
      });

      it('should validate role values', async () => {
        const response = await request(server)
          .put(`/api/users/${testUser._id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'invalid-role' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      it('should reject non-admin access', async () => {
        await request(server)
          .put(`/api/users/${testUser._id}/role`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ role: 'moderator' })
          .expect(403);
      });
    });

    describe('DELETE /api/users/:id', () => {
      it('should deactivate user for admin', async () => {
        const response = await request(server)
          .delete(`/api/users/${testUser._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deactivated');

        // Verify user is deactivated
        const user = await User.findById(testUser._id);
        expect(user.isActive).toBe(false);
      });

      it('should reject non-admin access', async () => {
        await request(server)
          .delete(`/api/users/${testUser._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });

    describe('GET /api/users/stats', () => {
      it('should get user statistics for admin', async () => {
        const response = await request(server)
          .get('/api/users/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toBeDefined();
        expect(response.body.data.stats.totalUsers).toBeGreaterThanOrEqual(2);
        expect(response.body.data.stats.activeUsers).toBeGreaterThanOrEqual(2);
      });

      it('should reject non-admin access', async () => {
        await request(server)
          .get('/api/users/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
      });
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to endpoints', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(server)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    }, 10000);
  });

  describe('Error handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(server)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid ObjectId parameters', async () => {
      const response = await request(server)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid ID');
    });
  });
});