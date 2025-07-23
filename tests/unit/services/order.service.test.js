const orderService = require('../../../examples/05-swarm-apps/rest-api-advanced/src/services/order.service');
const Order = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/order.model');
const Product = require('../../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
const ApiError = require('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/ApiError');
const { faker } = require('@faker-js/faker');

// Mock dependencies
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/order.model');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/models/product.model');
jest.mock('../../../examples/05-swarm-apps/rest-api-advanced/src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const orderData = {
        items: [
          { product: '507f1f77bcf86cd799439012', quantity: 2, price: 99.99 },
          { product: '507f1f77bcf86cd799439013', quantity: 1, price: 149.99 },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'City',
          state: 'State',
          zipCode: '12345',
          country: 'Country',
        },
      };

      const mockProducts = [
        { _id: '507f1f77bcf86cd799439012', stock: 10, price: 99.99 },
        { _id: '507f1f77bcf86cd799439013', stock: 5, price: 149.99 },
      ];

      const mockOrder = {
        _id: '507f1f77bcf86cd799439014',
        user: userId,
        items: orderData.items,
        totalAmount: 349.97,
        status: 'pending',
      };

      Product.find.mockResolvedValue(mockProducts);
      Order.create.mockResolvedValue(mockOrder);

      const result = await orderService.createOrder(userId, orderData);

      expect(Product.find).toHaveBeenCalledWith({
        _id: { $in: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'] },
        isActive: true,
      });
      expect(Order.create).toHaveBeenCalledWith({
        user: userId,
        items: orderData.items,
        totalAmount: 349.97,
        shippingAddress: orderData.shippingAddress,
        status: 'pending',
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw error for insufficient stock', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const orderData = {
        items: [
          { product: '507f1f77bcf86cd799439012', quantity: 15, price: 99.99 },
        ],
      };

      const mockProducts = [
        { _id: '507f1f77bcf86cd799439012', stock: 10, price: 99.99 },
      ];

      Product.find.mockResolvedValue(mockProducts);

      await expect(orderService.createOrder(userId, orderData))
        .rejects
        .toThrow(new ApiError('Insufficient stock for product 507f1f77bcf86cd799439012', 400));
    });

    it('should throw error for invalid product', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const orderData = {
        items: [
          { product: '507f1f77bcf86cd799439012', quantity: 2, price: 99.99 },
        ],
      };

      Product.find.mockResolvedValue([]); // No products found

      await expect(orderService.createOrder(userId, orderData))
        .rejects
        .toThrow(new ApiError('Product not found: 507f1f77bcf86cd799439012', 404));
    });
  });

  describe('getOrderById', () => {
    it('should return order by id with populated data', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const mockOrder = {
        _id: orderId,
        user: { _id: '1', name: 'John Doe', email: 'john@example.com' },
        items: [
          {
            product: { _id: '2', name: 'Product 1', price: 99.99 },
            quantity: 2,
            price: 99.99,
          },
        ],
        totalAmount: 199.98,
        status: 'pending',
      };

      Order.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrder),
        }),
      });

      const result = await orderService.getOrderById(orderId);

      expect(Order.findById).toHaveBeenCalledWith(orderId);
      expect(result).toEqual(mockOrder);
    });

    it('should throw error when order not found', async () => {
      const orderId = '507f1f77bcf86cd799439011';

      Order.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(orderService.getOrderById(orderId))
        .rejects
        .toThrow(new ApiError('Order not found', 404));
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const newStatus = 'shipped';
      const mockOrder = {
        _id: orderId,
        status: 'processing',
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);

      const result = await orderService.updateOrderStatus(orderId, newStatus);

      expect(mockOrder.status).toBe(newStatus);
      expect(mockOrder.statusHistory).toHaveLength(1);
      expect(mockOrder.statusHistory[0]).toMatchObject({
        status: newStatus,
        timestamp: expect.any(Date),
      });
      expect(mockOrder.save).toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should throw error for invalid status transition', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const newStatus = 'pending';
      const mockOrder = {
        _id: orderId,
        status: 'delivered', // Can't go back to pending from delivered
      };

      Order.findById.mockResolvedValue(mockOrder);

      await expect(orderService.updateOrderStatus(orderId, newStatus))
        .rejects
        .toThrow(new ApiError('Invalid status transition from delivered to pending', 400));
    });
  });

  describe('getUserOrders', () => {
    it('should return user orders with pagination', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const options = { page: 1, limit: 10 };
      const mockOrders = [
        { _id: '1', totalAmount: 199.98, status: 'delivered' },
        { _id: '2', totalAmount: 99.99, status: 'pending' },
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue(mockOrders),
              }),
            }),
          }),
        }),
      });
      Order.countDocuments.mockResolvedValue(2);

      const result = await orderService.getUserOrders(userId, options);

      expect(Order.find).toHaveBeenCalledWith({ user: userId });
      expect(result.orders).toEqual(mockOrders);
      expect(result.totalOrders).toBe(2);
    });

    it('should filter orders by status', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const options = { page: 1, limit: 10, status: 'delivered' };

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      Order.countDocuments.mockResolvedValue(0);

      await orderService.getUserOrders(userId, options);

      expect(Order.find).toHaveBeenCalledWith({
        user: userId,
        status: 'delivered',
      });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockOrder = {
        _id: orderId,
        user: userId,
        status: 'pending',
        items: [
          { product: '507f1f77bcf86cd799439013', quantity: 2 },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockProduct = {
        _id: '507f1f77bcf86cd799439013',
        stock: 10,
        save: jest.fn().mockResolvedValue(true),
      };

      Order.findById.mockResolvedValue(mockOrder);
      Product.findById.mockResolvedValue(mockProduct);

      await orderService.cancelOrder(orderId, userId);

      expect(mockOrder.status).toBe('cancelled');
      expect(mockOrder.cancelledAt).toBeInstanceOf(Date);
      expect(mockProduct.stock).toBe(12); // Stock restored
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockProduct.save).toHaveBeenCalled();
    });

    it('should throw error for non-cancellable order status', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockOrder = {
        _id: orderId,
        user: userId,
        status: 'delivered', // Cannot cancel delivered orders
      };

      Order.findById.mockResolvedValue(mockOrder);

      await expect(orderService.cancelOrder(orderId, userId))
        .rejects
        .toThrow(new ApiError('Order cannot be cancelled', 400));
    });

    it('should throw error for unauthorized cancellation', async () => {
      const orderId = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      const mockOrder = {
        _id: orderId,
        user: '507f1f77bcf86cd799439999', // Different user
        status: 'pending',
      };

      Order.findById.mockResolvedValue(mockOrder);

      await expect(orderService.cancelOrder(orderId, userId))
        .rejects
        .toThrow(new ApiError('Unauthorized to cancel this order', 403));
    });
  });

  describe('getOrderStats', () => {
    it('should return order statistics', async () => {
      const mockStats = [
        {
          _id: null,
          totalOrders: 100,
          totalRevenue: 10000,
          averageOrderValue: 100,
          pendingOrders: 20,
          processingOrders: 30,
          shippedOrders: 40,
          deliveredOrders: 10,
        },
      ];

      Order.aggregate.mockResolvedValue(mockStats);

      const result = await orderService.getOrderStats();

      expect(result).toEqual({
        totalOrders: 100,
        totalRevenue: 10000,
        averageOrderValue: 100,
        pendingOrders: 20,
        processingOrders: 30,
        shippedOrders: 40,
        deliveredOrders: 10,
      });
    });
  });

  describe('getOrdersByDateRange', () => {
    it('should return orders within date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const mockOrders = [
        { _id: '1', createdAt: new Date('2023-06-15'), totalAmount: 199.98 },
        { _id: '2', createdAt: new Date('2023-08-20'), totalAmount: 299.99 },
      ];

      Order.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      const result = await orderService.getOrdersByDateRange(startDate, endDate);

      expect(Order.find).toHaveBeenCalledWith({
        createdAt: { $gte: startDate, $lte: endDate },
      });
      expect(result).toEqual(mockOrders);
    });
  });
});