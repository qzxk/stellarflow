const request = require('supertest');
const app = require('../../examples/05-swarm-apps/rest-api-advanced/server');
const User = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/User');
const Product = require('../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
const authService = require('../../examples/05-swarm-apps/rest-api-advanced/src/services/auth.service');
const { faker } = require('@faker-js/faker');

describe('Performance & Load Tests', () => {
  let server;
  let authToken;
  let adminToken;
  let testUsers = [];
  let testProducts = [];

  beforeAll(() => {
    server = app;
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Product.deleteMany({});
    
    // Create test users
    const userPromises = [];
    for (let i = 0; i < 50; i++) {
      userPromises.push(
        User.create({
          email: faker.internet.email(),
          password: 'TestPass123!',
          name: faker.person.fullName(),
          role: i === 0 ? 'admin' : 'user',
          isEmailVerified: true,
          isActive: true,
        })
      );
    }
    
    testUsers = await Promise.all(userPromises);
    
    // Create test products
    const productPromises = [];
    for (let i = 0; i < 100; i++) {
      productPromises.push(
        Product.create({
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          price: parseFloat(faker.commerce.price()),
          category: faker.commerce.department().toLowerCase(),
          stock: faker.number.int({ min: 0, max: 100 }),
          isActive: true,
        })
      );
    }
    
    testProducts = await Promise.all(productPromises);
    
    // Generate tokens
    authToken = authService.generateAccessToken(testUsers[1]); // Regular user
    adminToken = authService.generateAccessToken(testUsers[0]); // Admin user
  }, 30000); // Increase timeout for setup

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent authentication requests', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map((_, index) => 
        request(server)
          .post('/api/auth/login')
          .send({
            email: testUsers[index % testUsers.length].email,
            password: 'TestPass123!',
          })
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
      });
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      console.log(`${concurrentRequests} concurrent login requests completed in ${duration}ms`);
      console.log(`Average response time: ${duration / concurrentRequests}ms`);
    }, 10000);

    it('should handle concurrent profile reads', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map(() =>
        request(server)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      expect(duration).toBeLessThan(3000); // 3 seconds
      
      console.log(`${concurrentRequests} concurrent profile reads completed in ${duration}ms`);
    }, 10000);

    it('should handle concurrent product list requests', async () => {
      const concurrentRequests = 30;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map((_, index) =>
        request(server)
          .get(`/api/products?page=${(index % 5) + 1}&limit=10`)
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.products).toBeInstanceOf(Array);
      });
      
      expect(duration).toBeLessThan(4000); // 4 seconds
      
      console.log(`${concurrentRequests} concurrent product list requests completed in ${duration}ms`);
    }, 10000);
  });

  describe('Database Query Performance', () => {
    it('should efficiently handle large user listings', async () => {
      const startTime = Date.now();
      
      const response = await request(server)
        .get('/api/users?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.body.data.users).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      console.log(`Large user listing query completed in ${duration}ms`);
    });

    it('should efficiently handle complex product searches', async () => {
      const searchQueries = [
        'electronics',
        'computer',
        'phone',
        'book',
        'clothing',
      ];
      
      const startTime = Date.now();
      
      const requests = searchQueries.map(query =>
        request(server)
          .get(`/api/products?search=${query}&limit=20`)
      );
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      expect(duration).toBeLessThan(2000); // 2 seconds for all searches
      
      console.log(`${searchQueries.length} complex search queries completed in ${duration}ms`);
    });

    it('should efficiently handle pagination requests', async () => {
      const pageRequests = [];
      
      // Request first 10 pages
      for (let page = 1; page <= 10; page++) {
        pageRequests.push(
          request(server)
            .get(`/api/products?page=${page}&limit=10`)
        );
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(pageRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.data.pagination.currentPage).toBe(index + 1);
      });
      
      expect(duration).toBeLessThan(3000); // 3 seconds for 10 pages
      
      console.log(`10 paginated requests completed in ${duration}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated requests', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();
      
      const requests = [];
      for (let i = 0; i < iterations; i++) {
        requests.push(
          request(server)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }
      
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory increase after ${iterations} requests: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, 15000);
  });

  describe('Response Time Benchmarks', () => {
    it('should meet response time requirements for authentication', async () => {
      const iterations = 20;
      const responseTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(server)
          .post('/api/auth/login')
          .send({
            email: testUsers[i % testUsers.length].email,
            password: 'TestPass123!',
          })
          .expect(200);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      console.log(`Authentication Response Times:`);
      console.log(`  Average: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`  Min: ${minResponseTime}ms`);
      console.log(`  Max: ${maxResponseTime}ms`);
      
      // Requirements: average < 500ms, max < 1000ms
      expect(averageResponseTime).toBeLessThan(500);
      expect(maxResponseTime).toBeLessThan(1000);
    });

    it('should meet response time requirements for data retrieval', async () => {
      const iterations = 30;
      const responseTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(server)
          .get('/api/products?limit=20')
          .expect(200);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(0.95 * iterations)];
      
      console.log(`Data Retrieval Response Times:`);
      console.log(`  Average: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`  95th Percentile: ${p95ResponseTime}ms`);
      
      // Requirements: average < 300ms, 95th percentile < 500ms
      expect(averageResponseTime).toBeLessThan(300);
      expect(p95ResponseTime).toBeLessThan(500);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle high throughput for read operations', async () => {
      const duration = 5000; // 5 seconds
      const startTime = Date.now();
      let requestCount = 0;
      const errors = [];
      
      const makeRequest = async () => {
        try {
          const response = await request(server)
            .get('/api/products?limit=10');
          
          if (response.status !== 200) {
            errors.push(response.status);
          }
          requestCount++;
        } catch (error) {
          errors.push(error.message);
        }
      };
      
      // Make requests continuously for the duration
      const requestPromises = [];
      while (Date.now() - startTime < duration) {
        requestPromises.push(makeRequest());
        
        // Prevent overwhelming the system
        if (requestPromises.length >= 50) {
          await Promise.all(requestPromises.splice(0, 25));
        }
      }
      
      // Wait for remaining requests
      await Promise.all(requestPromises);
      
      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;
      
      console.log(`Throughput Test Results:`);
      console.log(`  Total Requests: ${requestCount}`);
      console.log(`  Duration: ${actualDuration}ms`);
      console.log(`  Requests/Second: ${requestsPerSecond.toFixed(2)}`);
      console.log(`  Errors: ${errors.length}`);
      
      // Requirements: > 50 requests/second with < 5% error rate
      expect(requestsPerSecond).toBeGreaterThan(50);
      expect(errors.length / requestCount).toBeLessThan(0.05);
    }, 10000);
  });

  describe('Stress Tests', () => {
    it('should gracefully handle resource exhaustion', async () => {
      const heavyRequests = 200;
      const startTime = Date.now();
      
      const requests = Array(heavyRequests).fill().map((_, index) =>
        request(server)
          .get(`/api/users?limit=50&page=${(index % 10) + 1}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .timeout(5000) // 5 second timeout
      );
      
      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const successful = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const failed = responses.length - successful;
      const successRate = (successful / responses.length) * 100;
      
      console.log(`Stress Test Results:`);
      console.log(`  Total Requests: ${heavyRequests}`);
      console.log(`  Successful: ${successful}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`  Duration: ${duration}ms`);
      
      // Should maintain at least 80% success rate under stress
      expect(successRate).toBeGreaterThan(80);
    }, 20000);
  });
});