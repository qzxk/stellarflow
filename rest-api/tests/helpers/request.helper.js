import request from 'supertest';
import app from '../../server.js';

export class RequestHelper {
  constructor(authToken = null) {
    this.authToken = authToken;
    this.baseURL = '/api';
  }

  setAuthToken(token) {
    this.authToken = token;
    return this;
  }

  clearAuthToken() {
    this.authToken = null;
    return this;
  }

  // Generic request method
  async makeRequest(method, endpoint, data = null, headers = {}) {
    const req = request(app)[method.toLowerCase()](`${this.baseURL}${endpoint}`);
    
    // Add auth header if token exists
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }

    // Add custom headers
    Object.entries(headers).forEach(([key, value]) => {
      req.set(key, value);
    });

    // Add data for POST/PUT/PATCH requests
    if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
      req.send(data);
    }

    return req;
  }

  // Convenience methods
  async get(endpoint, headers = {}) {
    return this.makeRequest('GET', endpoint, null, headers);
  }

  async post(endpoint, data, headers = {}) {
    return this.makeRequest('POST', endpoint, data, headers);
  }

  async put(endpoint, data, headers = {}) {
    return this.makeRequest('PUT', endpoint, data, headers);
  }

  async patch(endpoint, data, headers = {}) {
    return this.makeRequest('PATCH', endpoint, data, headers);
  }

  async delete(endpoint, headers = {}) {
    return this.makeRequest('DELETE', endpoint, null, headers);
  }

  // Auth-specific helpers
  async login(credentials) {
    const response = await this.post('/auth/login', credentials);
    if (response.status === 200 && response.body.token) {
      this.authToken = response.body.token;
    }
    return response;
  }

  async register(userData) {
    return this.post('/auth/register', userData);
  }

  async logout() {
    const response = await this.post('/auth/logout');
    this.authToken = null;
    return response;
  }

  // Assertion helpers
  static expectSuccess(response, statusCode = 200) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toBeDefined();
    return response.body;
  }

  static expectError(response, statusCode, errorMessage = null) {
    expect(response.status).toBe(statusCode);
    expect(response.body.error).toBeDefined();
    if (errorMessage) {
      expect(response.body.error).toContain(errorMessage);
    }
    return response.body;
  }

  static expectPagination(response, expectedFields = ['data', 'total', 'page', 'limit']) {
    expectedFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
    expect(Array.isArray(response.body.data)).toBe(true);
    return response.body;
  }
}

// Export a factory function
export const createRequest = (authToken = null) => new RequestHelper(authToken);