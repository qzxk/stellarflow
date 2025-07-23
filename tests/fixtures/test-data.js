/**
 * Test Data Fixtures
 * Centralized test data for consistent testing across all test suites
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Helper function to generate ObjectIds
const generateId = () => new mongoose.Types.ObjectId();

// Helper function to hash passwords
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

// User fixtures
const users = {
  admin: {
    _id: generateId(),
    email: 'admin@testdomain.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  user: {
    _id: generateId(),
    email: 'user@testdomain.com',
    password: 'UserPassword123!',
    name: 'Regular User',
    role: 'user',
    status: 'active',
    emailVerified: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  manager: {
    _id: generateId(),
    email: 'manager@testdomain.com',
    password: 'ManagerPassword123!',
    name: 'Manager User',
    role: 'manager',
    status: 'active',
    emailVerified: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  suspended: {
    _id: generateId(),
    email: 'suspended@testdomain.com',
    password: 'SuspendedPassword123!',
    name: 'Suspended User',
    role: 'user',
    status: 'suspended',
    emailVerified: true,
    suspendedAt: new Date('2025-01-01T00:00:00Z'),
    suspendedReason: 'Terms violation',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  unverified: {
    _id: generateId(),
    email: 'unverified@testdomain.com',
    password: 'UnverifiedPassword123!',
    name: 'Unverified User',
    role: 'user',
    status: 'active',
    emailVerified: false,
    emailVerificationToken: 'verification-token-123',
    emailVerificationExpire: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
  },

  // Helper to get user with hashed password
  async getUserWithHashedPassword(userKey) {
    const user = { ...users[userKey] };
    user.password = await hashPassword(user.password);
    return user;
  },

  // Generate multiple test users
  generateTestUsers: (count = 10) => {
    const testUsers = [];
    for (let i = 0; i < count; i++) {
      testUsers.push({
        _id: generateId(),
        email: `testuser${i}@testdomain.com`,
        password: `TestPassword${i}123!`,
        name: `Test User ${i}`,
        role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'manager' : 'user',
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }\n    return testUsers;\n  }\n};\n\n// Product fixtures\nconst products = {\n  laptop: {\n    _id: generateId(),\n    name: 'High-Performance Laptop',\n    description: 'Latest generation laptop with high-end specifications',\n    price: 1299.99,\n    category: 'electronics',\n    subcategory: 'computers',\n    brand: 'TechBrand',\n    model: 'UltraBook Pro',\n    sku: 'LPT-001',\n    stock: 25,\n    lowStockThreshold: 5,\n    images: [\n      'laptop-main.jpg',\n      'laptop-side.jpg',\n      'laptop-open.jpg'\n    ],\n    specifications: {\n      processor: 'Intel i7',\n      ram: '16GB',\n      storage: '512GB SSD',\n      screen: '15.6 inch 4K',\n      weight: '1.8kg'\n    },\n    features: ['Backlit Keyboard', 'Fingerprint Reader', 'USB-C', 'WiFi 6'],\n    warranty: '2 years',\n    status: 'active',\n    rating: 4.5,\n    reviewCount: 124,\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-01T00:00:00Z')\n  },\n\n  smartphone: {\n    _id: generateId(),\n    name: 'Premium Smartphone',\n    description: 'Latest smartphone with advanced camera and AI features',\n    price: 899.99,\n    category: 'electronics',\n    subcategory: 'phones',\n    brand: 'PhoneBrand',\n    model: 'SmartPhone X',\n    sku: 'PHN-002',\n    stock: 50,\n    lowStockThreshold: 10,\n    images: [\n      'phone-front.jpg',\n      'phone-back.jpg',\n      'phone-side.jpg'\n    ],\n    specifications: {\n      screen: '6.7 inch OLED',\n      camera: '108MP Triple Camera',\n      battery: '4500mAh',\n      storage: '256GB',\n      ram: '8GB'\n    },\n    features: ['5G Ready', 'Wireless Charging', 'Water Resistant', 'Face ID'],\n    warranty: '1 year',\n    status: 'active',\n    rating: 4.7,\n    reviewCount: 89,\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-01T00:00:00Z')\n  },\n\n  headphones: {\n    _id: generateId(),\n    name: 'Wireless Noise-Canceling Headphones',\n    description: 'Premium wireless headphones with active noise cancellation',\n    price: 299.99,\n    category: 'electronics',\n    subcategory: 'audio',\n    brand: 'AudioBrand',\n    model: 'QuietSound Pro',\n    sku: 'HDP-003',\n    stock: 75,\n    lowStockThreshold: 15,\n    images: [\n      'headphones-main.jpg',\n      'headphones-folded.jpg',\n      'headphones-case.jpg'\n    ],\n    specifications: {\n      type: 'Over-ear',\n      connectivity: 'Bluetooth 5.0',\n      batteryLife: '30 hours',\n      chargingTime: '2 hours',\n      weight: '250g'\n    },\n    features: ['Active Noise Canceling', 'Quick Charge', 'Voice Assistant', 'Foldable'],\n    warranty: '2 years',\n    status: 'active',\n    rating: 4.6,\n    reviewCount: 156,\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-01T00:00:00Z')\n  },\n\n  outOfStock: {\n    _id: generateId(),\n    name: 'Out of Stock Item',\n    description: 'This item is currently out of stock',\n    price: 199.99,\n    category: 'electronics',\n    subcategory: 'accessories',\n    brand: 'TestBrand',\n    model: 'OutOfStock',\n    sku: 'OOS-001',\n    stock: 0,\n    lowStockThreshold: 5,\n    images: ['oos-item.jpg'],\n    status: 'out_of_stock',\n    rating: 4.0,\n    reviewCount: 12,\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-01T00:00:00Z')\n  },\n\n  discontinued: {\n    _id: generateId(),\n    name: 'Discontinued Item',\n    description: 'This item has been discontinued',\n    price: 99.99,\n    category: 'electronics',\n    subcategory: 'accessories',\n    brand: 'OldBrand',\n    model: 'Legacy',\n    sku: 'DSC-001',\n    stock: 5,\n    lowStockThreshold: 0,\n    images: ['discontinued-item.jpg'],\n    status: 'discontinued',\n    rating: 3.5,\n    reviewCount: 45,\n    createdAt: new Date('2024-01-01T00:00:00Z'),\n    updatedAt: new Date('2024-06-01T00:00:00Z')\n  },\n\n  // Generate multiple test products\n  generateTestProducts: (count = 10) => {\n    const testProducts = [];\n    const categories = ['electronics', 'books', 'clothing', 'home', 'sports'];\n    const brands = ['Brand A', 'Brand B', 'Brand C', 'Brand D'];\n    \n    for (let i = 0; i < count; i++) {\n      testProducts.push({\n        _id: generateId(),\n        name: `Test Product ${i}`,\n        description: `Description for test product ${i}`,\n        price: Math.round((Math.random() * 500 + 10) * 100) / 100,\n        category: categories[i % categories.length],\n        brand: brands[i % brands.length],\n        sku: `TST-${i.toString().padStart(3, '0')}`,\n        stock: Math.floor(Math.random() * 100) + 1,\n        lowStockThreshold: 5,\n        images: [`test-product-${i}.jpg`],\n        status: 'active',\n        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,\n        reviewCount: Math.floor(Math.random() * 100),\n        createdAt: new Date(),\n        updatedAt: new Date()\n      });\n    }\n    return testProducts;\n  }\n};\n\n// Order fixtures\nconst orders = {\n  pending: {\n    _id: generateId(),\n    user: users.user._id,\n    items: [\n      {\n        product: products.laptop._id,\n        productName: products.laptop.name,\n        quantity: 1,\n        unitPrice: products.laptop.price,\n        totalPrice: products.laptop.price\n      }\n    ],\n    subtotal: products.laptop.price,\n    tax: products.laptop.price * 0.08,\n    shipping: 15.99,\n    total: products.laptop.price + (products.laptop.price * 0.08) + 15.99,\n    status: 'pending',\n    paymentStatus: 'pending',\n    paymentMethod: 'credit_card',\n    shippingAddress: {\n      fullName: 'John Doe',\n      street: '123 Test Street',\n      city: 'Test City',\n      state: 'Test State',\n      zipCode: '12345',\n      country: 'USA',\n      phone: '+1-555-0123'\n    },\n    billingAddress: {\n      fullName: 'John Doe',\n      street: '123 Test Street',\n      city: 'Test City',\n      state: 'Test State',\n      zipCode: '12345',\n      country: 'USA',\n      phone: '+1-555-0123'\n    },\n    orderNumber: 'ORD-2025-001',\n    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-01T00:00:00Z')\n  },\n\n  processing: {\n    _id: generateId(),\n    user: users.user._id,\n    items: [\n      {\n        product: products.smartphone._id,\n        productName: products.smartphone.name,\n        quantity: 1,\n        unitPrice: products.smartphone.price,\n        totalPrice: products.smartphone.price\n      },\n      {\n        product: products.headphones._id,\n        productName: products.headphones.name,\n        quantity: 2,\n        unitPrice: products.headphones.price,\n        totalPrice: products.headphones.price * 2\n      }\n    ],\n    subtotal: products.smartphone.price + (products.headphones.price * 2),\n    tax: (products.smartphone.price + (products.headphones.price * 2)) * 0.08,\n    shipping: 0, // Free shipping\n    total: (products.smartphone.price + (products.headphones.price * 2)) * 1.08,\n    status: 'processing',\n    paymentStatus: 'paid',\n    paymentMethod: 'paypal',\n    paymentTransactionId: 'PAY-123456789',\n    shippingAddress: {\n      fullName: 'Jane Smith',\n      street: '456 Another Street',\n      city: 'Another City',\n      state: 'Another State',\n      zipCode: '67890',\n      country: 'USA',\n      phone: '+1-555-0456'\n    },\n    orderNumber: 'ORD-2025-002',\n    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),\n    createdAt: new Date('2025-01-02T00:00:00Z'),\n    updatedAt: new Date('2025-01-02T12:00:00Z')\n  },\n\n  shipped: {\n    _id: generateId(),\n    user: users.manager._id,\n    items: [\n      {\n        product: products.headphones._id,\n        productName: products.headphones.name,\n        quantity: 1,\n        unitPrice: products.headphones.price,\n        totalPrice: products.headphones.price\n      }\n    ],\n    subtotal: products.headphones.price,\n    tax: products.headphones.price * 0.08,\n    shipping: 9.99,\n    total: products.headphones.price * 1.08 + 9.99,\n    status: 'shipped',\n    paymentStatus: 'paid',\n    paymentMethod: 'credit_card',\n    paymentTransactionId: 'CC-987654321',\n    shippingAddress: {\n      fullName: 'Bob Johnson',\n      street: '789 Third Avenue',\n      city: 'Third City',\n      state: 'Third State',\n      zipCode: '13579',\n      country: 'USA',\n      phone: '+1-555-0789'\n    },\n    trackingNumber: 'TRACK123456789',\n    shippedAt: new Date('2025-01-03T14:30:00Z'),\n    carrier: 'FedEx',\n    orderNumber: 'ORD-2025-003',\n    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-03T14:30:00Z')\n  },\n\n  delivered: {\n    _id: generateId(),\n    user: users.admin._id,\n    items: [\n      {\n        product: products.laptop._id,\n        productName: products.laptop.name,\n        quantity: 1,\n        unitPrice: products.laptop.price,\n        totalPrice: products.laptop.price\n      }\n    ],\n    subtotal: products.laptop.price,\n    tax: products.laptop.price * 0.08,\n    shipping: 0, // Free shipping\n    total: products.laptop.price * 1.08,\n    status: 'delivered',\n    paymentStatus: 'paid',\n    paymentMethod: 'bank_transfer',\n    paymentTransactionId: 'BT-456789123',\n    shippingAddress: {\n      fullName: 'Alice Admin',\n      street: '321 Admin Boulevard',\n      city: 'Admin City',\n      state: 'Admin State',\n      zipCode: '97531',\n      country: 'USA',\n      phone: '+1-555-0321'\n    },\n    trackingNumber: 'DELIVERED789123',\n    shippedAt: new Date('2025-01-01T10:00:00Z'),\n    deliveredAt: new Date('2025-01-05T16:45:00Z'),\n    carrier: 'UPS',\n    orderNumber: 'ORD-2025-004',\n    createdAt: new Date('2024-12-28T00:00:00Z'),\n    updatedAt: new Date('2025-01-05T16:45:00Z')\n  },\n\n  cancelled: {\n    _id: generateId(),\n    user: users.user._id,\n    items: [\n      {\n        product: products.smartphone._id,\n        productName: products.smartphone.name,\n        quantity: 1,\n        unitPrice: products.smartphone.price,\n        totalPrice: products.smartphone.price\n      }\n    ],\n    subtotal: products.smartphone.price,\n    tax: products.smartphone.price * 0.08,\n    shipping: 15.99,\n    total: products.smartphone.price * 1.08 + 15.99,\n    status: 'cancelled',\n    paymentStatus: 'refunded',\n    paymentMethod: 'credit_card',\n    paymentTransactionId: 'CC-CANCEL123',\n    refundTransactionId: 'REF-CANCEL123',\n    shippingAddress: {\n      fullName: 'John Doe',\n      street: '123 Test Street',\n      city: 'Test City',\n      state: 'Test State',\n      zipCode: '12345',\n      country: 'USA',\n      phone: '+1-555-0123'\n    },\n    cancelledAt: new Date('2025-01-02T08:30:00Z'),\n    cancellationReason: 'Customer requested cancellation',\n    orderNumber: 'ORD-2025-005',\n    createdAt: new Date('2025-01-01T00:00:00Z'),\n    updatedAt: new Date('2025-01-02T08:30:00Z')\n  },\n\n  // Generate multiple test orders\n  generateTestOrders: (userIds, productIds, count = 10) => {\n    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];\n    const paymentMethods = ['credit_card', 'paypal', 'bank_transfer'];\n    const testOrders = [];\n    \n    for (let i = 0; i < count; i++) {\n      const status = statuses[i % statuses.length];\n      const paymentMethod = paymentMethods[i % paymentMethods.length];\n      const subtotal = Math.round((Math.random() * 500 + 50) * 100) / 100;\n      const tax = Math.round(subtotal * 0.08 * 100) / 100;\n      const shipping = subtotal > 100 ? 0 : 15.99;\n      \n      testOrders.push({\n        _id: generateId(),\n        user: userIds[i % userIds.length],\n        items: [\n          {\n            product: productIds[i % productIds.length],\n            productName: `Test Product ${i}`,\n            quantity: Math.floor(Math.random() * 3) + 1,\n            unitPrice: subtotal,\n            totalPrice: subtotal\n          }\n        ],\n        subtotal,\n        tax,\n        shipping,\n        total: subtotal + tax + shipping,\n        status,\n        paymentStatus: status === 'cancelled' ? 'refunded' : status === 'pending' ? 'pending' : 'paid',\n        paymentMethod,\n        paymentTransactionId: `TEST-${i}-${Date.now()}`,\n        orderNumber: `ORD-TEST-${i.toString().padStart(3, '0')}`,\n        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),\n        updatedAt: new Date()\n      });\n    }\n    return testOrders;\n  }\n};\n\n// JWT tokens for testing\nconst tokens = {\n  valid: {\n    user: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2lkX2hlcmUiLCJlbWFpbCI6InVzZXJAdGVzdGRvbWFpbi5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTcwNDA2NzIwMCwiZXhwIjoxNzA0NjcyMDAwfQ.example_signature',\n    admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbl9pZF9oZXJlIiwiZW1haWwiOiJhZG1pbkB0ZXN0ZG9tYWluLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwNDA2NzIwMCwiZXhwIjoxNzA0NjcyMDAwfQ.example_signature',\n    manager: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJtYW5hZ2VyX2lkX2hlcmUiLCJlbWFpbCI6Im1hbmFnZXJAdGVzdGRvbWFpbi5jb20iLCJyb2xlIjoibWFuYWdlciIsImlhdCI6MTcwNDA2NzIwMCwiZXhwIjoxNzA0NjcyMDAwfQ.example_signature'\n  },\n  expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2lkX2hlcmUiLCJlbWFpbCI6InVzZXJAdGVzdGRvbWFpbi5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTU3NzgzNjgwMCwiZXhwIjoxNTc3ODM2ODAxfQ.expired_signature',\n  invalid: 'invalid.token.format',\n  malformed: 'not.a.valid.jwt'\n};\n\n// API response templates\nconst responses = {\n  success: (data = null, message = 'Success') => ({\n    success: true,\n    message,\n    data\n  }),\n\n  error: (error = 'An error occurred', statusCode = 400) => ({\n    success: false,\n    error,\n    statusCode\n  }),\n\n  validation: (errors = []) => ({\n    success: false,\n    error: 'Validation failed',\n    errors\n  }),\n\n  pagination: (data = [], page = 1, limit = 10, total = 0) => ({\n    success: true,\n    data,\n    pagination: {\n      page,\n      limit,\n      total,\n      pages: Math.ceil(total / limit)\n    }\n  })\n};\n\n// Error fixtures\nconst errors = {\n  validation: {\n    name: 'ValidationError',\n    message: 'Validation failed',\n    errors: [\n      { field: 'email', message: 'Invalid email format' },\n      { field: 'password', message: 'Password must be at least 8 characters' }\n    ]\n  },\n\n  authentication: {\n    name: 'AuthenticationError',\n    message: 'Authentication required',\n    statusCode: 401\n  },\n\n  authorization: {\n    name: 'AuthorizationError',\n    message: 'Insufficient permissions',\n    statusCode: 403\n  },\n\n  notFound: {\n    name: 'NotFoundError',\n    message: 'Resource not found',\n    statusCode: 404\n  },\n\n  conflict: {\n    name: 'ConflictError',\n    message: 'Resource already exists',\n    statusCode: 409\n  },\n\n  rateLimit: {\n    name: 'RateLimitError',\n    message: 'Too many requests',\n    statusCode: 429\n  },\n\n  server: {\n    name: 'InternalServerError',\n    message: 'Internal server error',\n    statusCode: 500\n  }\n};\n\nmodule.exports = {\n  users,\n  products,\n  orders,\n  tokens,\n  responses,\n  errors,\n  generateId,\n  hashPassword\n};"