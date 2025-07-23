import BaseModel from './BaseModel.js';
import { Database } from '../config/postgres.js';

class Order extends BaseModel {
  static get tableName() {
    return 'orders';
  }

  static get columns() {
    return [
      'id', 'order_number', 'user_id', 'status', 'total_amount',
      'subtotal', 'tax_amount', 'shipping_amount', 'discount_amount',
      'currency', 'payment_status', 'payment_method', 'shipping_address',
      'billing_address', 'notes', 'created_at', 'updated_at',
      'paid_at', 'shipped_at', 'delivered_at', 'cancelled_at'
    ];
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.user_id) {
      errors.push({ field: 'user_id', message: 'User ID is required' });
    }

    if (!this.total_amount || this.total_amount < 0) {
      errors.push({ field: 'total_amount', message: 'Total amount must be non-negative' });
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (this.status && !validStatuses.includes(this.status)) {
      errors.push({ field: 'status', message: 'Invalid order status' });
    }

    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded', 'partial_refund'];
    if (this.payment_status && !validPaymentStatuses.includes(this.payment_status)) {
      errors.push({ field: 'payment_status', message: 'Invalid payment status' });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Generate unique order number
  static generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  // Create new order
  static async create(orderData) {
    const data = { ...orderData };
    
    // Generate order number if not provided
    if (!data.order_number) {
      data.order_number = this.generateOrderNumber();
    }

    // Set defaults
    data.status = data.status || 'pending';
    data.payment_status = data.payment_status || 'pending';
    data.currency = data.currency || 'USD';
    data.subtotal = data.subtotal || 0;
    data.tax_amount = data.tax_amount || 0;
    data.shipping_amount = data.shipping_amount || 0;
    data.discount_amount = data.discount_amount || 0;

    // Calculate total if not provided
    if (!data.total_amount) {
      data.total_amount = 
        data.subtotal + 
        data.tax_amount + 
        data.shipping_amount - 
        data.discount_amount;
    }

    return await super.create(data);
  }

  // Find order by order number
  static async findByOrderNumber(orderNumber) {
    return await this.findOne({ order_number: orderNumber });
  }

  // Find orders by user
  static async findByUserId(userId, options = {}) {
    const { page = 1, limit = 10, status, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const conditions = [`user_id = $1`];
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM orders WHERE ${whereClause}`;
    const { count } = await Database.get(countQuery, params);

    // Get orders
    const query = `
      SELECT o.*, u.email as user_email, u.full_name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const orders = await Database.all(query, params);

    return {
      orders: orders.map(o => new Order(o)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  // Update order status
  async updateStatus(newStatus, notes = null) {
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Invalid order status');
    }

    const updates = { status: newStatus };

    // Set timestamp based on status
    switch (newStatus) {
      case 'shipped':
        updates.shipped_at = new Date();
        break;
      case 'delivered':
        updates.delivered_at = new Date();
        break;
      case 'cancelled':
        updates.cancelled_at = new Date();
        break;
    }

    if (notes) {
      updates.notes = this.notes ? `${this.notes}\n${notes}` : notes;
    }

    await Order.update({ id: this.id }, updates);
    Object.assign(this, updates);
    
    return this;
  }

  // Update payment status
  async updatePaymentStatus(newStatus) {
    const validStatuses = ['pending', 'paid', 'failed', 'refunded', 'partial_refund'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Invalid payment status');
    }

    const updates = { payment_status: newStatus };

    if (newStatus === 'paid' && !this.paid_at) {
      updates.paid_at = new Date();
    }

    await Order.update({ id: this.id }, updates);
    Object.assign(this, updates);
    
    return this;
  }

  // Get order items
  async getItems() {
    const query = `
      SELECT 
        oi.*,
        p.name as product_name,
        p.sku as product_sku,
        p.description as product_description
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;

    return await Database.all(query, [this.id]);
  }

  // Add order item
  async addItem(itemData) {
    const query = `
      INSERT INTO order_items (
        order_id, product_id, quantity, unit_price, 
        total_price, discount_amount, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const totalPrice = itemData.unit_price * itemData.quantity - (itemData.discount_amount || 0);

    const params = [
      this.id,
      itemData.product_id,
      itemData.quantity,
      itemData.unit_price,
      totalPrice,
      itemData.discount_amount || 0,
      new Date()
    ];

    const result = await Database.get(query, params);

    // Update order subtotal
    await this.recalculateTotals();

    return result;
  }

  // Recalculate order totals
  async recalculateTotals() {
    const query = `
      SELECT 
        SUM(total_price) as subtotal,
        SUM(discount_amount) as total_discount
      FROM order_items
      WHERE order_id = $1
    `;

    const { subtotal, total_discount } = await Database.get(query, [this.id]);

    this.subtotal = parseFloat(subtotal || 0);
    this.total_amount = this.subtotal + this.tax_amount + this.shipping_amount - this.discount_amount;

    await Order.update({ id: this.id }, {
      subtotal: this.subtotal,
      total_amount: this.total_amount
    });

    return this;
  }

  // Get order statistics
  static async getStatistics(options = {}) {
    const { userId, startDate, endDate } = options;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount)::numeric(10,2) as average_order_value,
        MIN(total_amount) as min_order_value,
        MAX(total_amount) as max_order_value,
        SUM(shipping_amount) as total_shipping,
        SUM(tax_amount) as total_tax,
        SUM(discount_amount) as total_discounts
      FROM orders
      ${whereClause}
    `;

    return await Database.get(query, params);
  }

  // Search orders
  static async search(searchTerm, options = {}) {
    const { page = 1, limit = 10, status, paymentStatus } = options;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Search in order number, user email, addresses
    conditions.push(`(
      order_number ILIKE $${paramIndex} OR
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = orders.user_id 
        AND (u.email ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex})
      ) OR
      shipping_address::text ILIKE $${paramIndex} OR
      billing_address::text ILIKE $${paramIndex}
    )`);
    params.push(`%${searchTerm}%`);
    paramIndex++;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (paymentStatus) {
      conditions.push(`payment_status = $${paramIndex++}`);
      params.push(paymentStatus);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM orders WHERE ${whereClause}`;
    const { count } = await Database.get(countQuery, params);

    // Search query
    const query = `
      SELECT o.*, u.email as user_email, u.full_name as user_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const orders = await Database.all(query, params);

    return {
      orders: orders.map(o => new Order(o)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
      searchTerm,
    };
  }

  // Get revenue by period
  static async getRevenueByPeriod(period = 'day', options = {}) {
    const { startDate, endDate, userId } = options;
    const conditions = ["payment_status = 'paid'"];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereClause = conditions.join(' AND ');

    let dateFormat;
    switch (period) {
      case 'hour':
        dateFormat = "DATE_TRUNC('hour', created_at)";
        break;
      case 'day':
        dateFormat = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "DATE_TRUNC('month', created_at)";
        break;
      case 'year':
        dateFormat = "DATE_TRUNC('year', created_at)";
        break;
      default:
        dateFormat = "DATE_TRUNC('day', created_at)";
    }

    const query = `
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue,
        AVG(total_amount)::numeric(10,2) as avg_order_value
      FROM orders
      WHERE ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `;

    return await Database.all(query, params);
  }
}

// OrderItem model for order line items
class OrderItem extends BaseModel {
  static get tableName() {
    return 'order_items';
  }

  static get columns() {
    return [
      'id', 'order_id', 'product_id', 'quantity', 'unit_price',
      'total_price', 'discount_amount', 'created_at', 'updated_at'
    ];
  }

  // Find items by order
  static async findByOrderId(orderId) {
    const query = `
      SELECT 
        oi.*,
        p.name as product_name,
        p.sku as product_sku,
        p.description as product_description,
        p.category as product_category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `;

    const items = await Database.all(query, [orderId]);
    return items.map(item => new OrderItem(item));
  }

  // Get top selling products
  static async getTopSellingProducts(options = {}) {
    const { limit = 10, startDate, endDate } = options;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`oi.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`oi.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.category as product_category,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_quantity_sold,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.unit_price)::numeric(10,2) as avg_selling_price
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} o.payment_status = 'paid'
      GROUP BY p.id, p.name, p.sku, p.category
      ORDER BY total_revenue DESC
      LIMIT $${paramIndex}
    `;

    params.push(limit);
    return await Database.all(query, params);
  }
}

export { Order, OrderItem };
export default Order;