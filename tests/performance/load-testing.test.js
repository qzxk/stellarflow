/**
 * Load Testing Suite
 * Comprehensive performance and load testing for API endpoints
 */

const request = require('supertest');
const app = require('../../examples/05-swarm-apps/rest-api-advanced/server');
const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const bcrypt = require('bcryptjs');

describe('Load Testing Suite', () => {
  let authToken;
  let testUsers = [];

  beforeAll(async () => {
    // Create test users for load testing
    console.log('🏗️ Setting up load test data...');
    
    for (let i = 0; i < 50; i++) {
      const user = await User.create({
        email: `loadtest${i}@example.com`,
        password: await bcrypt.hash('LoadTest123!', 12),
        name: `Load Test User ${i}`
      });
      testUsers.push(user);
    }

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUsers[0].email,
        password: 'LoadTest123!'
      });
    
    authToken = loginResponse.body.data.token;
    console.log('✅ Load test setup complete');
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
    await User.deleteMany({ email: { $regex: /^loadtest/ } });
    console.log('✅ Load test cleanup complete');
  });

  describe('Authentication Load Tests', () => {
    it('should handle multiple concurrent login requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers[i % testUsers.length].email,
            password: 'LoadTest123!'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assertions
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance metrics
      const avgResponseTime = duration / concurrentRequests;
      console.log(`📊 Login Load Test Results:`);
      console.log(`   Concurrent Requests: ${concurrentRequests}`);
      console.log(`   Total Time: ${duration}ms`);
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Requests per Second: ${(concurrentRequests / (duration / 1000)).toFixed(2)}`);

      // Performance thresholds
      expect(avgResponseTime).toBeLessThan(1000); // Average response time should be under 1s
      expect(duration).toBeLessThan(5000); // Total time should be under 5s
    }, 30000);

    it('should handle registration load with rate limiting', async () => {
      const startTime = Date.now();
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/auth/register')
          .send({
            email: `loadreg${Date.now()}_${i}@example.com`,
            password: 'LoadTest123!',
            name: `Load Reg User ${i}`
          });
        promises.push(promise);
      }

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count successful and failed requests
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
      const rateLimited = responses.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;

      console.log(`📊 Registration Load Test Results:`);
      console.log(`   Attempted Requests: ${concurrentRequests}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Rate Limited: ${rateLimited}`);
      console.log(`   Total Time: ${duration}ms`);

      // Should have some rate limiting in place
      expect(successful + rateLimited).toBe(concurrentRequests);
    }, 30000);
  });

  describe('API Endpoint Load Tests', () => {
    it('should handle concurrent profile requests', async () => {
      const startTime = Date.now();
      const concurrentRequests = 50;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${authToken}`);
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assertions
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance metrics
      const avgResponseTime = duration / concurrentRequests;
      console.log(`📊 Profile Load Test Results:`);
      console.log(`   Concurrent Requests: ${concurrentRequests}`);
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Requests per Second: ${(concurrentRequests / (duration / 1000)).toFixed(2)}`);

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(500); // Should be fast since it's a simple query
    }, 30000);

    it('should handle mixed request types under load', async () => {
      const startTime = Date.now();
      const totalRequests = 30;
      const promises = [];

      // Mix of different request types
      for (let i = 0; i < totalRequests; i++) {
        let promise;
        const requestType = i % 3;
        
        switch (requestType) {
          case 0:
            // GET profile
            promise = request(app)
              .get('/api/auth/profile')
              .set('Authorization', `Bearer ${authToken}`);
            break;
          case 1:
            // POST login
            promise = request(app)
              .post('/api/auth/login')
              .send({
                email: testUsers[i % testUsers.length].email,
                password: 'LoadTest123!'
              });
            break;
          case 2:
            // PUT profile update
            promise = request(app)
              .put('/api/auth/profile')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                name: `Updated Name ${i}`
              });
            break;
        }
        promises.push(promise);
      }

      const responses = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count results
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status < 400).length;
      const failed = responses.filter(r => r.status === 'rejected' || r.value.status >= 400).length;

      console.log(`📊 Mixed Load Test Results:`);
      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Success Rate: ${((successful / totalRequests) * 100).toFixed(2)}%`);
      console.log(`   Total Time: ${duration}ms`);

      // Should maintain high success rate under load
      expect(successful / totalRequests).toBeGreaterThan(0.9); // 90% success rate
    }, 30000);
  });

  describe('Database Performance Tests', () => {
    it('should handle concurrent database queries efficiently', async () => {
      const startTime = Date.now();
      const concurrentQueries = 25;
      const promises = [];

      for (let i = 0; i < concurrentQueries; i++) {
        const promise = User.findById(testUsers[i % testUsers.length]._id);
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all queries succeeded
      results.forEach(user => {
        expect(user).toBeTruthy();
        expect(user._id).toBeDefined();
      });

      console.log(`📊 Database Query Load Test Results:`);
      console.log(`   Concurrent Queries: ${concurrentQueries}`);
      console.log(`   Total Time: ${duration}ms`);
      console.log(`   Average Query Time: ${(duration / concurrentQueries).toFixed(2)}ms`);

      // Database performance assertions
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    }, 30000);

    it('should handle concurrent user creation', async () => {
      const startTime = Date.now();
      const concurrentCreations = 10;
      const promises = [];

      for (let i = 0; i < concurrentCreations; i++) {
        const promise = User.create({
          email: `concurrent${Date.now()}_${i}@example.com`,
          password: await bcrypt.hash('ConcurrentTest123!', 12),
          name: `Concurrent User ${i}`
        });
        promises.push(promise);
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count successful creations
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📊 Concurrent User Creation Results:`);
      console.log(`   Attempted: ${concurrentCreations}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Total Time: ${duration}ms`);

      // Should handle concurrent creation without conflicts
      expect(successful).toBeGreaterThan(concurrentCreations * 0.8); // At least 80% success

      // Cleanup created users
      const emails = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.email);
      await User.deleteMany({ email: { $in: emails } });
    }, 30000);
  });

  describe('Memory and Resource Tests', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      const requests = 100;
      
      // Perform sustained load
      for (let batch = 0; batch < 5; batch++) {
        const promises = [];
        
        for (let i = 0; i < requests / 5; i++) {
          const promise = request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${authToken}`);
          promises.push(promise);
        }
        
        await Promise.all(promises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`📊 Memory Usage Results:`);
      console.log(`   Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)`);

      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(200); // Less than 200% increase
    }, 60000);
  });

  describe('Error Handling Under Load', () => {
    it('should handle invalid requests gracefully under load', async () => {
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email-format',
            password: 'short'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All should return 400 or 401 (validation errors)
      responses.forEach(response => {
        expect([400, 401]).toContain(response.status);
        expect(response.body.success).toBe(false);
      });

      console.log(`📊 Error Handling Test: ${concurrentRequests} invalid requests handled correctly`);
    }, 30000);
  });
});