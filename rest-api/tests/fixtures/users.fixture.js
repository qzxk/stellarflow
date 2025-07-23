export const validUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User'
};

export const adminUser = {
  username: 'admin',
  email: 'admin@example.com',
  password: 'Admin123!@#',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin'
};

export const invalidUsers = {
  missingUsername: {
    email: 'test@example.com',
    password: 'Test123!@#'
  },
  invalidEmail: {
    username: 'testuser',
    email: 'invalid-email',
    password: 'Test123!@#'
  },
  weakPassword: {
    username: 'testuser',
    email: 'test@example.com',
    password: '123'
  },
  emptyFields: {
    username: '',
    email: '',
    password: ''
  }
};

export const userFactory = (overrides = {}) => ({
  username: `user-${Date.now()}`,
  email: `user-${Date.now()}@example.com`,
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  ...overrides
});

export const createUsers = (count, overrides = {}) => {
  return Array.from({ length: count }, (_, i) => userFactory({
    username: `user-${i}-${Date.now()}`,
    email: `user-${i}-${Date.now()}@example.com`,
    ...overrides
  }));
};