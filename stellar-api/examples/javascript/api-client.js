/**
 * Stellar API JavaScript Client Example
 * A complete example showing how to interact with the Stellar API
 */

const axios = require('axios');

class StellarAPIClient {
  constructor(baseURL = 'http://localhost:3000/api/v1') {
    this.baseURL = baseURL;
    this.accessToken = null;
    this.refreshToken = null;
    
    // Create axios instance with default config
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    // Add request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens();
            throw refreshError;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  // Store tokens securely
  setTokens(tokens) {
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) {
      this.refreshToken = tokens.refreshToken;
    }
    
    // In a real app, store refresh token securely (e.g., httpOnly cookie)
    // For demo purposes, we're storing in memory
  }
  
  // Clear tokens on logout
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }
  
  // Authentication methods
  async register(userData) {
    try {
      const response = await this.api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async login(identifier, password, rememberMe = false) {
    try {
      const response = await this.api.post('/auth/login', {
        identifier,
        password,
        rememberMe
      });
      
      this.setTokens(response.data.tokens);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async logout() {
    try {
      await this.api.post('/auth/logout', {
        refreshToken: this.refreshToken
      });
      this.clearTokens();
    } catch (error) {
      // Clear tokens even if logout fails
      this.clearTokens();
      throw this.handleError(error);
    }
  }
  
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await this.api.post('/auth/refresh', {
        refreshToken: this.refreshToken
      });
      
      this.accessToken = response.data.tokens.accessToken;
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async verifyEmail(token) {
    try {
      const response = await this.api.get(`/auth/verify-email?token=${token}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async forgotPassword(email) {
    try {
      const response = await this.api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async resetPassword(token, newPassword) {
    try {
      const response = await this.api.post('/auth/reset-password', {
        token,
        newPassword
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // User methods
  async getProfile() {
    try {
      const response = await this.api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async updateProfile(updates) {
    try {
      const response = await this.api.put('/users/profile', updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await this.api.post('/users/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async uploadAvatar(file) {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await this.api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async deleteAccount(password) {
    try {
      const response = await this.api.delete('/users/delete', {
        data: { password }
      });
      this.clearTokens();
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Admin methods
  async getUser(userId) {
    try {
      const response = await this.api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  async listUsers(params = {}) {
    try {
      const response = await this.api.get('/users', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Health check
  async checkHealth() {
    try {
      const response = await this.api.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Error handling
  handleError(error) {
    if (error.response) {
      // Server responded with error
      const { data, status, headers } = error.response;
      
      // Check for rate limiting
      if (status === 429) {
        const retryAfter = headers['retry-after'] || 60;
        return new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }
      
      // Return server error message
      return new Error(data.message || `Server error: ${status}`);
    } else if (error.request) {
      // Request made but no response
      return new Error('Network error: No response from server');
    } else {
      // Error in request setup
      return new Error(error.message || 'Request failed');
    }
  }
}

// Example usage
async function main() {
  const client = new StellarAPIClient();
  
  try {
    // Check API health
    console.log('Checking API health...');
    const health = await client.checkHealth();
    console.log('API Status:', health.status);
    
    // Register a new user
    console.log('\nRegistering new user...');
    const registerData = await client.register({
      username: 'johndoe',
      email: 'john@example.com',
      password: 'SecurePassword123!',
      profile: {
        firstName: 'John',
        lastName: 'Doe'
      }
    });
    console.log('Registration successful:', registerData.message);
    
    // Login
    console.log('\nLogging in...');
    const loginData = await client.login('john@example.com', 'SecurePassword123!', true);
    console.log('Login successful! User:', loginData.user.username);
    
    // Get profile
    console.log('\nFetching profile...');
    const profileData = await client.getProfile();
    console.log('Profile:', profileData.user);
    
    // Update profile
    console.log('\nUpdating profile...');
    const updateData = await client.updateProfile({
      profile: {
        bio: 'Full-stack developer passionate about building great APIs',
        phoneNumber: '+1-555-123-4567'
      }
    });
    console.log('Profile updated:', updateData.user.profile);
    
    // Change password
    console.log('\nChanging password...');
    const passwordData = await client.changePassword(
      'SecurePassword123!',
      'NewSecurePassword123!'
    );
    console.log('Password changed:', passwordData.message);
    
    // Logout
    console.log('\nLogging out...');
    await client.logout();
    console.log('Logged out successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Advanced example: Automatic retry with exponential backoff
class ResilientStellarClient extends StellarAPIClient {
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx except 429)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
  
  // Override methods to add retry logic
  async getProfile() {
    return this.retryWithBackoff(() => super.getProfile());
  }
  
  async updateProfile(updates) {
    return this.retryWithBackoff(() => super.updateProfile(updates));
  }
}

// Export for use in other modules
module.exports = { StellarAPIClient, ResilientStellarClient };

// Run example if called directly
if (require.main === module) {
  main();
}