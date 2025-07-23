const OrderService = require('../../src/services/order.service');
const Order = require('../../src/models/order.model');
const Product = require('../../src/models/product.model');
const ApiError = require('../../src/utils/ApiError');
const redis = require('../../src/config/redis');

// Mock dependencies
jest.mock('../../src/models/order.model');
jest.mock('../../src/models/product.model');
jest.mock('../../src/config/redis');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock console.log for email sending
const originalConsoleLog = console.log;

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    // Mock Redis
    redis.setex = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('calculateOrderTotals', () => {
    it('should calculate order totals correctly', () => {
      const items = [
        { price: 10.00, quantity: 2 },
        { price: 25.50, quantity: 1 },
        { price: 5.00, quantity: 3 },
      ];
      const taxRate = 8.25; // 8.25%
      const shippingAmount = 10.00;
      const discountAmount = 5.00;

      const result = OrderService.calculateOrderTotals(items, taxRate, shippingAmount, discountAmount);

      expect(result).toEqual({
        subtotal: 60.50, // (10*2 + 25.5*1 + 5*3)
        taxAmount: 4.99, // 60.50 * 0.0825
        totalAmount: 70.49, // 60.50 + 4.99 + 10 - 5
      });
    });

    it('should handle zero values', () => {
      const items = [{ price: 100, quantity: 1 }];
      const result = OrderService.calculateOrderTotals(items, 0, 0, 0);

      expect(result).toEqual({
        subtotal: 100,
        taxAmount: 0,
        totalAmount: 100,
      });
    });

    it('should handle empty items', () => {
      const result = OrderService.calculateOrderTotals([], 10, 5, 0);

      expect(result).toEqual({
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 5, // Only shipping
      });
    });
  });

  describe('validateDiscountCode', () => {
    it('should validate valid discount code', async () => {
      const result = await OrderService.validateDiscountCode('WELCOME10', 100, 'userId');

      expect(result).toEqual({
        code: 'WELCOME10',
        discountAmount: 10, // 10% of 100
        description: '10% off',
      });
    });

    it('should throw error for invalid code', async () => {
      await expect(OrderService.validateDiscountCode('INVALID', 100, 'userId'))
        .rejects
        .toThrow(new ApiError(400, 'Invalid discount code'));
    });

    it('should throw error for expired code', async () => {
      // Mock date to be in the future
      const originalDate = Date;
      const mockDate = new Date('2026-01-01');
      global.Date = jest.fn(() => mockDate);
      global.Date.now = originalDate.now;

      await expect(OrderService.validateDiscountCode('WELCOME10', 100, 'userId'))
        .rejects
        .toThrow(new ApiError(400, 'Discount code has expired'));

      global.Date = originalDate;
    });

    it('should throw error for minimum purchase not met', async () => {
      await expect(OrderService.validateDiscountCode('SAVE20', 50, 'userId'))
        .rejects
        .toThrow(new ApiError(400, 'Minimum purchase of $100 required for this discount'));
    });

    it('should calculate fixed discount correctly', async () => {
      const result = await OrderService.validateDiscountCode('FREESHIP', 100, 'userId');

      expect(result).toEqual({
        code: 'FREESHIP',
        discountAmount: 10, // Fixed $10
        description: '10$ off',
      });
    });

    it('should cap fixed discount to subtotal', async () => {
      const result = await OrderService.validateDiscountCode('FREESHIP', 8, 'userId');

      expect(result).toEqual({
        code: 'FREESHIP',
        discountAmount: 8, // Capped to subtotal
        description: '10$ off',
      });
    });
  });

  describe('reserveInventory', () => {
    it('should reserve inventory successfully', async () => {
      const items = [
        { product: '111', quantity: 2 },
        { product: '222', quantity: 1 },
      ];

      const mockProducts = [
        {
          _id: '111',
          name: 'Product 1',
          checkAvailability: jest.fn().mockReturnValue(true),
          updateInventory: jest.fn().mockResolvedValue(true),
        },
        {
          _id: '222',
          name: 'Product 2',
          checkAvailability: jest.fn().mockReturnValue(true),
          updateInventory: jest.fn().mockResolvedValue(true),
        },
      ];

      Product.findById
        .mockResolvedValueOnce(mockProducts[0])
        .mockResolvedValueOnce(mockProducts[1]);

      const result = await OrderService.reserveInventory(items);

      expect(result).toEqual([
        { productId: '111', quantity: 2 },
        { productId: '222', quantity: 1 },
      ]);
      expect(mockProducts[0].updateInventory).toHaveBeenCalledWith(2, 'decrement');
      expect(mockProducts[1].updateInventory).toHaveBeenCalledWith(1, 'decrement');
    });

    it('should throw error for non-existent product', async () => {
      const items = [{ product: '999', quantity: 1 }];
      Product.findById.mockResolvedValue(null);

      await expect(OrderService.reserveInventory(items))
        .rejects
        .toThrow(new ApiError(404, 'Product 999 not found'));
    });

    it('should throw error for insufficient stock', async () => {
      const items = [{ product: '111', quantity: 10 }];
      const mockProduct = {
        _id: '111',
        name: 'Product 1',
        checkAvailability: jest.fn().mockReturnValue(false),
      };

      Product.findById.mockResolvedValue(mockProduct);

      await expect(OrderService.reserveInventory(items))
        .rejects
        .toThrow(new ApiError(400, 'Insufficient stock for Product 1'));
    });

    it('should rollback on error', async () => {
      const items = [
        { product: '111', quantity: 2 },
        { product: '222', quantity: 1 },
      ];

      const mockProduct1 = {
        _id: '111',
        name: 'Product 1',
        checkAvailability: jest.fn().mockReturnValue(true),
        updateInventory: jest.fn().mockResolvedValue(true),
      };

      const mockProduct2 = {
        _id: '222',
        name: 'Product 2',
        checkAvailability: jest.fn().mockReturnValue(false),
      };

      Product.findById
        .mockResolvedValueOnce(mockProduct1)
        .mockResolvedValueOnce(mockProduct2)
        .mockResolvedValueOnce(mockProduct1); // For rollback

      OrderService.releaseInventory = jest.fn();

      await expect(OrderService.reserveInventory(items))
        .rejects
        .toThrow(new ApiError(400, 'Insufficient stock for Product 2'));

      expect(OrderService.releaseInventory).toHaveBeenCalledWith([
        { productId: '111', quantity: 2 },
      ]);
    });
  });

  describe('releaseInventory', () => {
    it('should release inventory successfully', async () => {
      const reservations = [
        { productId: '111', quantity: 2 },
        { productId: '222', quantity: 1 },
      ];

      const mockProducts = [
        {
          _id: '111',
          updateInventory: jest.fn().mockResolvedValue(true),
        },
        {
          _id: '222',
          updateInventory: jest.fn().mockResolvedValue(true),
        },
      ];

      Product.findById
        .mockResolvedValueOnce(mockProducts[0])
        .mockResolvedValueOnce(mockProducts[1]);

      await OrderService.releaseInventory(reservations);

      expect(mockProducts[0].updateInventory).toHaveBeenCalledWith(2, 'increment');
      expect(mockProducts[1].updateInventory).toHaveBeenCalledWith(1, 'increment');
    });

    it('should handle missing products gracefully', async () => {
      const reservations = [{ productId: '999', quantity: 1 }];
      Product.findById.mockResolvedValue(null);

      // Should not throw
      await expect(OrderService.releaseInventory(reservations))
        .resolves
        .not.toThrow();
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const paymentDetails = {
        method: 'credit_card',
        amount: 100,
        currency: 'USD',
      };

      // Mock Math.random to ensure success
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const result = await OrderService.processPayment(paymentDetails);

      expect(result).toMatchObject({
        transactionId: expect.stringMatching(/^TXN-\d+-[a-z0-9]+$/),
        status: 'completed',
        amount: 100,
        currency: 'USD',
        processedAt: expect.any(Date),
      });
    });

    it('should handle payment failure', async () => {
      const paymentDetails = {
        method: 'credit_card',
        amount: 100,
        currency: 'USD',
      };

      // Mock Math.random to ensure failure
      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      await expect(OrderService.processPayment(paymentDetails))
        .rejects
        .toThrow(new ApiError(400, 'Payment processing failed. Please try again.'));
    });
  });

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation and cache email data', async () => {
      const order = {
        _id: '123',
        orderNumber: 'ORD-2024-001',
        shippingAddress: { email: 'customer@example.com' },
      };

      await OrderService.sendOrderConfirmation(order);

      expect(console.log).toHaveBeenCalledWith(
        'Sending order confirmation email for order ORD-2024-001'
      );
      expect(redis.setex).toHaveBeenCalledWith(
        'email:order-confirmation:123',
        3600,
        expect.stringContaining('customer@example.com')
      );
    });
  });

  describe('calculateShippingEstimates', () => {
    it('should calculate shipping estimates', async () => {
      const shippingAddress = { city: 'New York', state: 'NY' };
      const items = [
        { price: 30, quantity: 1 },
        { price: 10, quantity: 1 },
      ];

      const result = await OrderService.calculateShippingEstimates(shippingAddress, items);

      expect(result).toHaveProperty('standard');
      expect(result).toHaveProperty('express');
      expect(result).toHaveProperty('overnight');
      expect(result).toHaveProperty('pickup');
      expect(result.standard.cost).toBe(5.99);
      expect(result.pickup.cost).toBe(0);
    });

    it('should apply free shipping for orders over $50', async () => {
      const shippingAddress = { city: 'Los Angeles', state: 'CA' };
      const items = [
        { price: 60, quantity: 1 },
      ];

      const result = await OrderService.calculateShippingEstimates(shippingAddress, items);

      expect(result.standard.cost).toBe(0); // Free shipping
      expect(result.express.cost).toBe(14.99);
    });
  });

  describe('getOrderTimeline', () => {
    it('should generate order timeline', async () => {
      const mockOrder = {
        _id: '123',
        createdAt: new Date('2024-01-01'),
        history: [
          {
            status: 'processing',
            timestamp: new Date('2024-01-02'),
            comment: 'Order is being processed',
            updatedBy: 'admin',
          },
        ],
        payment: {
          paidAt: new Date('2024-01-01T12:00:00'),
        },
        tracking: {
          shippedAt: new Date('2024-01-03'),
          carrier: 'FedEx',
          number: 'FDX123456',
          deliveredAt: new Date('2024-01-05'),
        },
      };

      Order.findById.mockResolvedValue(mockOrder);

      const result = await OrderService.getOrderTimeline('123');

      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({
        status: 'created',
        description: 'Order placed',
      });
      expect(result[1]).toMatchObject({
        status: 'payment_completed',
        description: 'Payment processed successfully',
      });
      expect(result[2]).toMatchObject({
        status: 'processing',
        description: 'Order is being processed',
      });
      expect(result[3]).toMatchObject({
        status: 'shipped',
        description: 'Shipped via FedEx',
        trackingNumber: 'FDX123456',
      });
      expect(result[4]).toMatchObject({
        status: 'delivered',
        description: 'Package delivered',
      });
    });

    it('should throw error for non-existent order', async () => {
      Order.findById.mockResolvedValue(null);

      await expect(OrderService.getOrderTimeline('nonexistent'))
        .rejects
        .toThrow(new ApiError(404, 'Order not found'));
    });
  });

  describe('getCustomerOrderHistory', () => {
    it('should return customer order history and statistics', async () => {
      const userId = 'user123';
      const mockOrders = [
        { orderNumber: 'ORD-001', status: 'delivered', totalAmount: 100 },
        { orderNumber: 'ORD-002', status: 'processing', totalAmount: 150 },
      ];

      const mockStats = [{
        _id: null,
        totalOrders: 5,
        totalSpent: 750,
        averageOrderValue: 150,
        firstOrderDate: new Date('2023-01-01'),
        lastOrderDate: new Date('2024-01-01'),
      }];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders),
      };

      Order.find.mockReturnValue(mockQuery);
      Order.aggregate.mockResolvedValue(mockStats);

      const result = await OrderService.getCustomerOrderHistory(userId);

      expect(Order.find).toHaveBeenCalledWith({ user: userId });
      expect(result.recentOrders).toEqual(mockOrders);
      expect(result.statistics).toEqual(mockStats[0]);
    });

    it('should handle customer with no orders', async () => {
      const userId = 'newuser';
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      Order.find.mockReturnValue(mockQuery);
      Order.aggregate.mockResolvedValue([]);

      const result = await OrderService.getCustomerOrderHistory(userId);

      expect(result.recentOrders).toEqual([]);
      expect(result.statistics).toEqual({
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        firstOrderDate: null,
        lastOrderDate: null,
      });
    });
  });

  describe('checkFraudRisk', () => {
    it('should detect high risk for high-value first order', async () => {
      const orderData = {
        totalAmount: 1000,
        user: 'user123',
        billingAddressSameAsShipping: true,
        shippingMethod: 'standard',
      };

      Order.countDocuments.mockResolvedValue(0);

      const result = await OrderService.checkFraudRisk(orderData);

      expect(result).toMatchObject({
        riskScore: 30,
        riskLevel: 'medium',
        riskFactors: ['High value first order'],
        requiresReview: false,
      });
    });

    it('should detect multiple risk factors', async () => {
      const orderData = {
        totalAmount: 600,
        user: 'user123',
        billingAddressSameAsShipping: false,
        shippingMethod: 'overnight',
      };

      Order.countDocuments.mockResolvedValue(0);

      const result = await OrderService.checkFraudRisk(orderData);

      expect(result.riskScore).toBe(65); // 30 + 20 + 15
      expect(result.riskLevel).toBe('high');
      expect(result.riskFactors).toContain('High value first order');
      expect(result.riskFactors).toContain('Different billing and shipping addresses');
      expect(result.riskFactors).toContain('Rush shipping on first order');
      expect(result.requiresReview).toBe(true);
    });

    it('should detect low risk for normal orders', async () => {
      const orderData = {
        totalAmount: 100,
        user: 'user123',
        billingAddressSameAsShipping: true,
        shippingMethod: 'standard',
      };

      Order.countDocuments.mockResolvedValue(5);

      const result = await OrderService.checkFraudRisk(orderData);

      expect(result).toMatchObject({
        riskScore: 0,
        riskLevel: 'low',
        riskFactors: [],
        requiresReview: false,
      });
    });
  });

  describe('generateInvoicePDF', () => {
    it('should generate invoice data', async () => {
      const mockOrder = {
        _id: '123',
        orderNumber: 'ORD-2024-001',
        createdAt: new Date('2024-01-01'),
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
        },
        billingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        items: [
          { product: { name: 'Product 1', sku: 'SKU1' }, quantity: 2, price: 50 },
        ],
        subtotal: 100,
        taxAmount: 8,
        shippingAmount: 10,
        discountAmount: 5,
        totalAmount: 113,
        payment: { method: 'credit_card', status: 'completed' },
      };

      const populateQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      populateQuery.populate.mockResolvedValue(mockOrder);

      Order.findById.mockReturnValue(populateQuery);

      const result = await OrderService.generateInvoicePDF('123');

      expect(result).toMatchObject({
        invoiceNumber: 'INV-ORD-2024-001',
        invoiceDate: expect.any(Date),
        dueDate: expect.any(Date),
        order: {
          number: 'ORD-2024-001',
          date: mockOrder.createdAt,
        },
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123-456-7890',
          billingAddress: mockOrder.billingAddress,
        },
        totals: {
          subtotal: 100,
          tax: 8,
          shipping: 10,
          discount: 5,
          total: 113,
        },
        payment: {
          method: 'credit_card',
          status: 'completed',
        },
      });
    });

    it('should throw error for non-existent order', async () => {
      const populateQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      populateQuery.populate.mockResolvedValue(null);

      Order.findById.mockReturnValue(populateQuery);

      await expect(OrderService.generateInvoicePDF('nonexistent'))
        .rejects
        .toThrow(new ApiError(404, 'Order not found'));
    });
  });

  describe('getOrderMetrics', () => {
    it('should calculate order metrics for specified period', async () => {
      const mockMetrics = [{
        summary: [{
          _id: null,
          totalOrders: 50,
          totalRevenue: 10000,
          averageOrderValue: 200,
          totalItems: 150,
        }],
        byStatus: [
          { _id: 'delivered', count: 30, value: 6000 },
          { _id: 'processing', count: 10, value: 2000 },
          { _id: 'pending', count: 10, value: 2000 },
        ],
        byPaymentMethod: [
          { _id: 'credit_card', count: 40, value: 8000 },
          { _id: 'paypal', count: 10, value: 2000 },
        ],
        topProducts: [
          { _id: 'prod1', name: 'Product 1', quantity: 50, revenue: 2500 },
          { _id: 'prod2', name: 'Product 2', quantity: 30, revenue: 1800 },
        ],
      }];

      Order.aggregate.mockResolvedValue(mockMetrics);

      const result = await OrderService.getOrderMetrics('month');

      expect(result).toEqual(mockMetrics[0]);
      expect(Order.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              createdAt: { $gte: expect.any(Date) },
            }),
          }),
        ])
      );
    });

    it('should handle different time periods', async () => {
      const periods = ['today', 'week', 'month', 'year'];
      
      for (const period of periods) {
        jest.clearAllMocks();
        Order.aggregate.mockResolvedValue([{ summary: [] }]);
        
        await OrderService.getOrderMetrics(period);
        
        expect(Order.aggregate).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('getAbandonedCarts', () => {
    it('should return abandoned carts placeholder', async () => {
      const result = await OrderService.getAbandonedCarts(24);

      expect(result).toEqual({
        carts: [],
        totalValue: 0,
        averageValue: 0,
      });
    });
  });
});