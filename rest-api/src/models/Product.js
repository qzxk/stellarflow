import { Database } from '../config/database.js';

class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = data.price;
    this.stock_quantity = data.stock_quantity;
    this.category_id = data.category_id;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.sku = data.sku;
    this.image_url = data.image_url;
    this.weight = data.weight;
    this.dimensions = data.dimensions;
  }

  // Convert to safe object (exclude sensitive data)
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      stock_quantity: this.stock_quantity,
      category_id: this.category_id,
      created_by: this.created_by,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_active: this.is_active,
      sku: this.sku,
      image_url: this.image_url,
      weight: this.weight,
      dimensions: this.dimensions
    };
  }

  // Create a new product
  static async create(productData) {
    const db = Database.getConnection();
    const query = `
      INSERT INTO products (
        name, description, price, stock_quantity, category_id,
        created_by, sku, image_url, weight, dimensions, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      productData.name,
      productData.description,
      productData.price,
      productData.stock_quantity || 0,
      productData.category_id || null,
      productData.created_by,
      productData.sku || null,
      productData.image_url || null,
      productData.weight || null,
      productData.dimensions || null,
      productData.is_active !== undefined ? productData.is_active : true
    ];

    const result = await db.run(query, params);
    return Product.findById(result.lastID);
  }

  // Find product by ID
  static async findById(id) {
    const db = Database.getConnection();
    const query = 'SELECT * FROM products WHERE id = ?';
    const product = await db.get(query, [id]);
    return product ? new Product(product) : null;
  }

  // Find product by SKU
  static async findBySku(sku) {
    const db = Database.getConnection();
    const query = 'SELECT * FROM products WHERE sku = ?';
    const product = await db.get(query, [sku]);
    return product ? new Product(product) : null;
  }

  // Find all products with pagination and filters
  static async findAll(options = {}) {
    const db = Database.getConnection();
    const {
      page = 1,
      limit = 10,
      category_id,
      min_price,
      max_price,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
      is_active = true,
      in_stock_only = false
    } = options;

    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];

    // Build conditions
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (category_id) {
      conditions.push('category_id = ?');
      params.push(category_id);
    }

    if (min_price !== undefined) {
      conditions.push('price >= ?');
      params.push(min_price);
    }

    if (max_price !== undefined) {
      conditions.push('price <= ?');
      params.push(max_price);
    }

    if (in_stock_only) {
      conditions.push('stock_quantity > 0');
    }

    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR sku LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['name', 'price', 'created_at', 'updated_at', 'stock_quantity'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM products ${whereClause}`;
    const { total } = await db.get(countQuery, params);

    // Get products
    const query = `
      SELECT * FROM products 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const products = await db.all(query, params);
    
    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Update product
  async update(updateData) {
    const db = Database.getConnection();
    const allowedFields = [
      'name', 'description', 'price', 'stock_quantity', 
      'category_id', 'sku', 'image_url', 'weight', 
      'dimensions', 'is_active'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      return this;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(this.id);

    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(query, params);

    // Reload and return updated product
    return Product.findById(this.id);
  }

  // Delete product (soft delete)
  async delete() {
    const db = Database.getConnection();
    const query = `UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await db.run(query, [this.id]);
    this.is_active = false;
    return true;
  }

  // Hard delete product
  async hardDelete() {
    const db = Database.getConnection();
    const query = 'DELETE FROM products WHERE id = ?';
    await db.run(query, [this.id]);
    return true;
  }

  // Update stock quantity
  async updateStock(quantity, operation = 'set') {
    const db = Database.getConnection();
    let query;
    
    switch (operation) {
      case 'increment':
        query = 'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        break;
      case 'decrement':
        query = 'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        break;
      default: // 'set'
        query = 'UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    }
    
    await db.run(query, [quantity, this.id]);
    const updated = await Product.findById(this.id);
    this.stock_quantity = updated.stock_quantity;
    return this;
  }

  // Check if product is in stock
  isInStock() {
    return this.stock_quantity > 0;
  }

  // Get products by category
  static async findByCategory(categoryId, options = {}) {
    return Product.findAll({ ...options, category_id: categoryId });
  }

  // Get low stock products
  static async findLowStock(threshold = 10, options = {}) {
    const db = Database.getConnection();
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) as total FROM products WHERE stock_quantity <= ? AND is_active = 1';
    const { total } = await db.get(countQuery, [threshold]);

    const query = `
      SELECT * FROM products 
      WHERE stock_quantity <= ? AND is_active = 1
      ORDER BY stock_quantity ASC
      LIMIT ? OFFSET ?
    `;
    
    const products = await db.all(query, [threshold, limit, offset]);
    
    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get product statistics
  static async getStatistics(userId = null) {
    const db = Database.getConnection();
    let baseCondition = 'WHERE is_active = 1';
    let params = [];

    if (userId) {
      baseCondition += ' AND created_by = ?';
      params.push(userId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_products,
        SUM(stock_quantity) as total_stock,
        AVG(price) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN stock_quantity <= 10 AND stock_quantity > 0 THEN 1 END) as low_stock_count
      FROM products ${baseCondition}
    `;

    return db.get(query, params);
  }
}

export default Product;