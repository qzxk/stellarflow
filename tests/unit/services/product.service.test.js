const productService = require('../../../examples/05-swarm-apps/rest-api-advanced/src/services/product.service');
const Product = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
const ApiError = require('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/ApiError');
const { faker } = require('@faker-js/faker');

// Mock dependencies
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        category: 'electronics',
        stock: 10,
      };
      const mockProduct = { _id: '507f1f77bcf86cd799439011', ...productData };

      Product.create.mockResolvedValue(mockProduct);

      const result = await productService.createProduct(productData);

      expect(Product.create).toHaveBeenCalledWith(productData);
      expect(result).toEqual(mockProduct);
    });

    it('should throw error for duplicate product name', async () => {
      const productData = {
        name: 'Existing Product',
        price: 99.99,
      };

      Product.create.mockRejectedValue({
        code: 11000,
        keyPattern: { name: 1 },
      });

      await expect(productService.createProduct(productData))
        .rejects
        .toThrow(new ApiError('Product with this name already exists', 400));
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        price: 99.99,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await productService.getProductById(productId);

      expect(Product.findById).toHaveBeenCalledWith(productId);
      expect(result).toEqual(mockProduct);
    });

    it('should throw error when product not found', async () => {
      const productId = '507f1f77bcf86cd799439011';
      Product.findById.mockResolvedValue(null);

      await expect(productService.getProductById(productId))
        .rejects
        .toThrow(new ApiError('Product not found', 404));
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Updated Product', price: 149.99 };
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        price: 99.99,
        save: jest.fn().mockResolvedValue(true),
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await productService.updateProduct(productId, updateData);

      expect(Product.findById).toHaveBeenCalledWith(productId);
      expect(mockProduct.name).toBe(updateData.name);
      expect(mockProduct.price).toBe(updateData.price);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw error for non-existent product', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Updated Product' };

      Product.findById.mockResolvedValue(null);

      await expect(productService.updateProduct(productId, updateData))
        .rejects
        .toThrow(new ApiError('Product not found', 404));
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Product.findById.mockResolvedValue(mockProduct);

      await productService.deleteProduct(productId);

      expect(mockProduct.isActive).toBe(false);
      expect(mockProduct.deletedAt).toBeInstanceOf(Date);
      expect(mockProduct.save).toHaveBeenCalled();
    });

    it('should throw error for non-existent product', async () => {
      const productId = '507f1f77bcf86cd799439011';
      Product.findById.mockResolvedValue(null);

      await expect(productService.deleteProduct(productId))
        .rejects
        .toThrow(new ApiError('Product not found', 404));
    });
  });

  describe('getProductsWithFilters', () => {
    it('should return filtered products with pagination', async () => {
      const filters = {
        category: 'electronics',
        minPrice: 50,
        maxPrice: 200,
        page: 1,
        limit: 10,
      };
      const mockProducts = [
        { _id: '1', name: 'Product 1', price: 99.99, category: 'electronics' },
        { _id: '2', name: 'Product 2', price: 149.99, category: 'electronics' },
      ];

      Product.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      });
      Product.countDocuments.mockResolvedValue(2);

      const result = await productService.getProductsWithFilters(filters);

      expect(Product.find).toHaveBeenCalledWith({
        isActive: true,
        category: 'electronics',
        price: { $gte: 50, $lte: 200 },
      });
      expect(result.products).toEqual(mockProducts);
      expect(result.totalProducts).toBe(2);
    });

    it('should apply search filter', async () => {
      const filters = { search: 'laptop', page: 1, limit: 10 };
      const mockProducts = [
        { _id: '1', name: 'Gaming Laptop', price: 999.99 },
      ];

      Product.find.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockProducts),
          }),
        }),
      });
      Product.countDocuments.mockResolvedValue(1);

      await productService.getProductsWithFilters(filters);

      expect(Product.find).toHaveBeenCalledWith({
        isActive: true,
        $or: [
          { name: { $regex: 'laptop', $options: 'i' } },
          { description: { $regex: 'laptop', $options: 'i' } },
        ],
      });
    });
  });

  describe('updateProductStock', () => {
    it('should update stock successfully', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const quantity = 5;
      const mockProduct = {
        _id: productId,
        stock: 10,
        save: jest.fn().mockResolvedValue(true),
      };

      Product.findById.mockResolvedValue(mockProduct);

      await productService.updateProductStock(productId, quantity);

      expect(mockProduct.stock).toBe(15);
      expect(mockProduct.save).toHaveBeenCalled();
    });

    it('should throw error for insufficient stock when reducing', async () => {
      const productId = '507f1f77bcf86cd799439011';
      const quantity = -15; // Trying to reduce by 15
      const mockProduct = {
        _id: productId,
        stock: 10, // Only 10 in stock
      };

      Product.findById.mockResolvedValue(mockProduct);

      await expect(productService.updateProductStock(productId, quantity))
        .rejects
        .toThrow(new ApiError('Insufficient stock', 400));
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products by category', async () => {
      const category = 'electronics';
      const mockProducts = [
        { _id: '1', name: 'Product 1', category: 'electronics' },
        { _id: '2', name: 'Product 2', category: 'electronics' },
      ];

      Product.find.mockResolvedValue(mockProducts);

      const result = await productService.getProductsByCategory(category);

      expect(Product.find).toHaveBeenCalledWith({
        category: 'electronics',
        isActive: true,
      });
      expect(result).toEqual(mockProducts);
    });
  });

  describe('getProductStats', () => {
    it('should return product statistics', async () => {
      const mockStats = [
        {
          _id: null,
          totalProducts: 50,
          activeProducts: 45,
          inactiveProducts: 5,
          totalValue: 5000,
          averagePrice: 100,
        },
      ];

      Product.aggregate.mockResolvedValue(mockStats);

      const result = await productService.getProductStats();

      expect(result).toEqual({
        totalProducts: 50,
        activeProducts: 45,
        inactiveProducts: 5,
        totalValue: 5000,
        averagePrice: 100,
      });
    });
  });

  describe('bulkUpdateProducts', () => {
    it('should update multiple products', async () => {
      const updates = [
        { _id: '1', price: 99.99 },
        { _id: '2', stock: 20 },
      ];

      Product.bulkWrite.mockResolvedValue({
        modifiedCount: 2,
        matchedCount: 2,
      });

      const result = await productService.bulkUpdateProducts(updates);

      expect(Product.bulkWrite).toHaveBeenCalled();
      expect(result.modifiedCount).toBe(2);
    });
  });
});