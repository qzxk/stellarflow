const ProductService = require('../../src/services/product.service');
const Product = require('../../src/models/product.model');
const ApiError = require('../../src/utils/ApiError');
const redis = require('../../src/config/redis');

// Mock dependencies
jest.mock('../../src/models/product.model');
jest.mock('../../src/config/redis');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('ProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Redis client
    redis.get = jest.fn();
    redis.setex = jest.fn();
    redis.del = jest.fn();
  });

  describe('getProductById', () => {
    const mockProductId = '123456789';
    const mockProduct = {
      _id: mockProductId,
      name: 'Test Product',
      price: 99.99,
      rating: { average: 4.5, count: 100 },
      inventory: { quantity: 50 },
    };

    it('should return cached product if available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockProduct));

      const result = await ProductService.getProductById(mockProductId);

      expect(redis.get).toHaveBeenCalledWith(`product:${mockProductId}`);
      expect(Product.findById).not.toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should fetch from database if not cached', async () => {
      redis.get.mockResolvedValue(null);
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockResolvedValue(mockProduct);
      Product.findById.mockReturnValue(mockQuery);

      const result = await ProductService.getProductById(mockProductId);

      expect(redis.get).toHaveBeenCalledWith(`product:${mockProductId}`);
      expect(Product.findById).toHaveBeenCalledWith(mockProductId);
      expect(mockQuery.populate).toHaveBeenCalledWith('reviews.user', 'name avatar');
      expect(mockQuery.populate).toHaveBeenCalledWith('relatedProducts', 'name price images rating');
      expect(redis.setex).toHaveBeenCalledWith(
        `product:${mockProductId}`,
        3600,
        JSON.stringify(mockProduct)
      );
      expect(result).toEqual(mockProduct);
    });

    it('should throw error if product not found', async () => {
      redis.get.mockResolvedValue(null);
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockQuery.populate.mockResolvedValue(null);
      Product.findById.mockReturnValue(mockQuery);

      await expect(ProductService.getProductById(mockProductId))
        .rejects
        .toThrow(new ApiError(404, 'Product not found'));
    });
  });

  describe('invalidateProductCache', () => {
    it('should delete product from cache', async () => {
      const productId = '123456789';
      await ProductService.invalidateProductCache(productId);

      expect(redis.del).toHaveBeenCalledWith(`product:${productId}`);
    });
  });

  describe('checkBulkAvailability', () => {
    it('should check availability for multiple products', async () => {
      const items = [
        { product: '111', quantity: 5 },
        { product: '222', quantity: 10 },
        { product: '333', quantity: 3 },
      ];

      const mockProducts = [
        {
          _id: '111',
          name: 'Product 1',
          isAvailable: true,
          checkAvailability: jest.fn().mockReturnValue(true),
          inventory: { quantity: 10 },
        },
        {
          _id: '222',
          name: 'Product 2',
          isAvailable: true,
          checkAvailability: jest.fn().mockReturnValue(false),
          inventory: { quantity: 5 },
        },
        null, // Product not found
      ];

      Product.findById
        .mockResolvedValueOnce(mockProducts[0])
        .mockResolvedValueOnce(mockProducts[1])
        .mockResolvedValueOnce(mockProducts[2]);

      const results = await ProductService.checkBulkAvailability(items);

      expect(results).toEqual([
        {
          product: '111',
          available: true,
          error: null,
          maxQuantity: 10,
        },
        {
          product: '222',
          available: false,
          error: 'Insufficient stock. Available: 5',
          maxQuantity: 5,
        },
        {
          product: '333',
          available: false,
          error: 'Product not found',
        },
      ]);
    });

    it('should handle unavailable products', async () => {
      const items = [{ product: '444', quantity: 1 }];

      const mockProduct = {
        _id: '444',
        name: 'Unavailable Product',
        isAvailable: false,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const results = await ProductService.checkBulkAvailability(items);

      expect(results[0]).toEqual({
        product: '444',
        available: false,
        error: 'Product not available',
      });
    });
  });

  describe('updateProductMetrics', () => {
    it('should update views and sales count', async () => {
      const productId = '123456789';
      const metrics = {
        views: 10,
        salesCount: 2,
      };

      await ProductService.updateProductMetrics(productId, metrics);

      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(productId, {
        $inc: { views: 10, salesCount: 2 },
      });
      expect(redis.del).toHaveBeenCalledWith(`product:${productId}`);
    });

    it('should handle partial metrics', async () => {
      const productId = '123456789';
      const metrics = { views: 5 };

      await ProductService.updateProductMetrics(productId, metrics);

      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(productId, {
        $inc: { views: 5 },
      });
    });
  });

  describe('getRecommendations', () => {
    it('should return product recommendations', async () => {
      const mockRecommendations = [
        { _id: '1', name: 'Popular Product 1', salesCount: 100 },
        { _id: '2', name: 'Popular Product 2', salesCount: 80 },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockRecommendations),
      };

      Product.find.mockReturnValue(mockQuery);

      const result = await ProductService.getRecommendations('userId123', 5);

      expect(Product.find).toHaveBeenCalledWith({
        status: 'active',
        visibility: 'visible',
      });
      expect(mockQuery.sort).toHaveBeenCalledWith('-salesCount -rating.average');
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockRecommendations);
    });
  });

  describe('calculateDynamicPrice', () => {
    it('should increase price for high demand', async () => {
      const mockProduct = {
        _id: '123',
        price: 100,
        inventory: { quantity: 5 },
        salesCount: 150,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await ProductService.calculateDynamicPrice('123');

      expect(result).toEqual({
        originalPrice: 100,
        dynamicPrice: 110,
        priceMultiplier: 1.1,
        reason: 'high_demand',
      });
    });

    it('should decrease price for low demand', async () => {
      const mockProduct = {
        _id: '123',
        price: 100,
        inventory: { quantity: 200 },
        salesCount: 5,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await ProductService.calculateDynamicPrice('123');

      expect(result).toEqual({
        originalPrice: 100,
        dynamicPrice: 90,
        priceMultiplier: 0.9,
        reason: 'low_demand',
      });
    });

    it('should maintain price for normal demand', async () => {
      const mockProduct = {
        _id: '123',
        price: 100,
        inventory: { quantity: 50 },
        salesCount: 50,
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await ProductService.calculateDynamicPrice('123');

      expect(result).toEqual({
        originalPrice: 100,
        dynamicPrice: 100,
        priceMultiplier: 1,
        reason: 'normal',
      });
    });

    it('should throw error if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      await expect(ProductService.calculateDynamicPrice('nonexistent'))
        .rejects
        .toThrow(new ApiError(404, 'Product not found'));
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with low stock', async () => {
      const mockProducts = [
        { name: 'Product 1', sku: 'SKU1', inventory: { quantity: 3 } },
        { name: 'Product 2', sku: 'SKU2', inventory: { quantity: 7 } },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockQuery);

      const result = await ProductService.getLowStockProducts(10);

      expect(Product.find).toHaveBeenCalledWith({
        'inventory.trackInventory': true,
        'inventory.quantity': { $lte: 10, $gt: 0 },
        status: 'active',
      });
      expect(mockQuery.sort).toHaveBeenCalledWith('inventory.quantity');
      expect(result).toEqual(mockProducts);
    });
  });

  describe('bulkImportProducts', () => {
    it('should import products successfully', async () => {
      const products = [
        { sku: 'SKU1', name: 'Product 1', price: 10 },
        { sku: 'SKU2', name: 'Product 2', price: 20 },
      ];

      Product.create
        .mockResolvedValueOnce({ _id: '1', sku: 'SKU1', name: 'Product 1' })
        .mockResolvedValueOnce({ _id: '2', sku: 'SKU2', name: 'Product 2' });

      const result = await ProductService.bulkImportProducts(products, 'vendorId');

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(Product.create).toHaveBeenCalledWith({
        ...products[0],
        vendor: 'vendorId',
      });
    });

    it('should handle import failures', async () => {
      const products = [
        { sku: 'SKU1', name: 'Product 1', price: 10 },
        { sku: 'DUPLICATE', name: 'Duplicate Product', price: 15 },
      ];

      Product.create
        .mockResolvedValueOnce({ _id: '1', sku: 'SKU1', name: 'Product 1' })
        .mockRejectedValueOnce(new Error('Duplicate SKU'));

      const result = await ProductService.bulkImportProducts(products, 'vendorId');

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        sku: 'DUPLICATE',
        name: 'Duplicate Product',
        error: 'Duplicate SKU',
      });
    });
  });

  describe('getProductAnalytics', () => {
    it('should return product analytics with recommendations', async () => {
      const mockProduct = {
        _id: '123',
        name: 'Test Product',
        sku: 'TEST-SKU',
        views: 2000,
        salesCount: 5,
        price: 50,
        rating: { average: 2.5, count: 20 },
        inventory: { quantity: 3, lowStockThreshold: 10 },
      };

      Product.findById.mockResolvedValue(mockProduct);

      const result = await ProductService.getProductAnalytics('123', 30);

      expect(result.product).toMatchObject({
        id: '123',
        name: 'Test Product',
        sku: 'TEST-SKU',
      });
      expect(result.metrics).toMatchObject({
        views: 2000,
        salesCount: 5,
        revenue: 250,
        averageRating: 2.5,
        reviewCount: 20,
        currentStock: 3,
      });
      expect(result.recommendations).toContain('Restock soon - inventory is low');
      expect(result.recommendations).toContain('Consider improving product quality based on reviews');
      expect(result.recommendations).toContain('High views but low conversion - consider adjusting price or description');
    });

    it('should throw error for non-existent product', async () => {
      Product.findById.mockResolvedValue(null);

      await expect(ProductService.getProductAnalytics('nonexistent'))
        .rejects
        .toThrow(new ApiError(404, 'Product not found'));
    });
  });

  describe('searchProducts', () => {
    it('should search products with text query', async () => {
      const searchParams = {
        query: 'laptop',
        filters: { category: 'electronics' },
        pagination: { page: 1, limit: 10 },
      };

      const mockProducts = [
        { _id: '1', name: 'Gaming Laptop', category: 'electronics' },
        { _id: '2', name: 'Business Laptop', category: 'electronics' },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockQuery);
      Product.countDocuments.mockResolvedValue(2);
      Product.aggregate.mockResolvedValue([]);

      const result = await ProductService.searchProducts(searchParams);

      expect(Product.find).toHaveBeenCalledWith({
        status: 'active',
        visibility: { $in: ['visible', 'search'] },
        $text: { $search: 'laptop' },
        category: 'electronics',
      });
      expect(result.products).toEqual(mockProducts);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1,
      });
    });

    it('should include facets in search results', async () => {
      const searchParams = {
        query: 'phone',
        filters: {},
        facets: ['category', 'brand'],
      };

      const mockProducts = [];
      const mockCategoryFacets = [
        { _id: 'electronics', count: 10 },
        { _id: 'accessories', count: 5 },
      ];
      const mockBrandFacets = [
        { _id: 'Apple', count: 8 },
        { _id: 'Samsung', count: 7 },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockQuery);
      Product.countDocuments.mockResolvedValue(15);
      Product.aggregate
        .mockResolvedValueOnce(mockCategoryFacets)
        .mockResolvedValueOnce(mockBrandFacets);

      const result = await ProductService.searchProducts(searchParams);

      expect(result.facets.categories).toEqual(mockCategoryFacets);
      expect(result.facets.brands).toEqual(mockBrandFacets);
    });
  });

  describe('getProductsByTags', () => {
    it('should return products matching tags', async () => {
      const tags = ['new-arrival', 'trending'];
      const mockProducts = [
        { _id: '1', name: 'Product 1', tags: ['new-arrival'] },
        { _id: '2', name: 'Product 2', tags: ['trending', 'new-arrival'] },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockQuery);

      const result = await ProductService.getProductsByTags(tags, 10);

      expect(Product.find).toHaveBeenCalledWith({
        tags: { $in: tags },
        status: 'active',
        visibility: 'visible',
      });
      expect(mockQuery.sort).toHaveBeenCalledWith('-rating.average -salesCount');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockProducts);
    });
  });

  describe('getOutOfStockProducts', () => {
    it('should return out of stock products', async () => {
      const mockProducts = [
        { name: 'Product 1', sku: 'SKU1', category: 'electronics' },
        { name: 'Product 2', sku: 'SKU2', category: 'clothing' },
      ];

      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockProducts),
      };

      Product.find.mockReturnValue(mockQuery);

      const result = await ProductService.getOutOfStockProducts();

      expect(Product.find).toHaveBeenCalledWith({
        'inventory.trackInventory': true,
        'inventory.quantity': 0,
        'inventory.allowBackorder': false,
        status: 'active',
      });
      expect(result).toEqual(mockProducts);
    });
  });
});