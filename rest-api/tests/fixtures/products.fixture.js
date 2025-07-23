export const validProduct = {
  name: 'Test Product',
  description: 'This is a test product description',
  price: 29.99,
  category: 'Electronics',
  stock: 100,
  sku: 'TEST-001'
};

export const invalidProducts = {
  missingName: {
    description: 'Product without name',
    price: 10.00
  },
  invalidPrice: {
    name: 'Test Product',
    price: -5.00
  },
  negativeStock: {
    name: 'Test Product',
    price: 10.00,
    stock: -10
  }
};

export const productFactory = (overrides = {}) => ({
  name: `Product ${Date.now()}`,
  description: `Description for product ${Date.now()}`,
  price: Math.floor(Math.random() * 100) + 1,
  category: 'General',
  stock: Math.floor(Math.random() * 1000),
  sku: `SKU-${Date.now()}`,
  ...overrides
});

export const createProducts = (count, overrides = {}) => {
  return Array.from({ length: count }, (_, i) => productFactory({
    name: `Product ${i} - ${Date.now()}`,
    sku: `SKU-${i}-${Date.now()}`,
    ...overrides
  }));
};