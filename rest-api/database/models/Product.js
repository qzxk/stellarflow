const { query, transaction } = require('../connection');

class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = parseFloat(data.price);
    this.sku = data.sku;
    this.category = data.category;
    this.tags = data.tags || [];
    this.stockQuantity = data.stock_quantity;
    this.isAvailable = data.is_available;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    // Join fields
    this.createdByEmail = data.created_by_email;
    this.createdByName = data.created_by_name;
  }

  // Create a new product
  static async create({ name, description, price, sku, category, tags, stockQuantity, createdBy }) {
    const result = await query(
      `INSERT INTO products (name, description, price, sku, category, tags, stock_quantity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, description, price, sku, category, tags || [], stockQuantity || 0, createdBy]
    );

    return new Product(result.rows[0]);
  }

  // Find product by ID
  static async findById(id) {
    const result = await query(
      `SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
       FROM products p
       JOIN users u ON p.created_by = u.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] ? new Product(result.rows[0]) : null;
  }

  // Find product by SKU
  static async findBySku(sku) {
    const result = await query(
      `SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
       FROM products p
       JOIN users u ON p.created_by = u.id
       WHERE p.sku = $1`,
      [sku]
    );
    return result.rows[0] ? new Product(result.rows[0]) : null;
  }

  // List products with pagination and filters
  static async list({ 
    limit = 20, 
    offset = 0, 
    isAvailable = null, 
    category = null, 
    minPrice = null,
    maxPrice = null,
    tags = null,
    search = null,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  }) {
    let queryText = `
      SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
      FROM products p
      JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (isAvailable !== null) {
      params.push(isAvailable);
      queryText += ` AND p.is_available = $${params.length}`;
    }

    if (category) {
      params.push(category);
      queryText += ` AND p.category = $${params.length}`;
    }

    if (minPrice !== null) {
      params.push(minPrice);
      queryText += ` AND p.price >= $${params.length}`;
    }

    if (maxPrice !== null) {
      params.push(maxPrice);
      queryText += ` AND p.price <= $${params.length}`;
    }

    if (tags && tags.length > 0) {
      params.push(tags);
      queryText += ` AND p.tags && $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['name', 'price', 'created_at', 'updated_at', 'stock_quantity'];
    if (!allowedSortColumns.includes(sortBy)) {
      sortBy = 'created_at';
    }

    queryText += ` ORDER BY p.${sortBy} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;
    
    params.push(limit, offset);
    queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryText, params);
    return result.rows.map(row => new Product(row));
  }

  // Count products
  static async count({ isAvailable = null, category = null, tags = null, search = null }) {
    let queryText = 'SELECT COUNT(*) FROM products WHERE 1=1';
    const params = [];

    if (isAvailable !== null) {
      params.push(isAvailable);
      queryText += ` AND is_available = $${params.length}`;
    }

    if (category) {
      params.push(category);
      queryText += ` AND category = $${params.length}`;
    }

    if (tags && tags.length > 0) {
      params.push(tags);
      queryText += ` AND tags && $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    const result = await query(queryText, params);
    return parseInt(result.rows[0].count);
  }

  // Get all categories
  static async getCategories() {
    const result = await query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );
    return result.rows.map(row => row.category);
  }

  // Get all tags
  static async getAllTags() {
    const result = await query(
      'SELECT DISTINCT unnest(tags) as tag FROM products ORDER BY tag'
    );
    return result.rows.map(row => row.tag);
  }

  // Update product
  async update(updates) {
    const allowedUpdates = [
      'name', 'description', 'price', 'sku', 'category', 
      'tags', 'stock_quantity', 'is_available'
    ];
    const updateFields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        params.push(value);
        updateFields.push(`${key} = $${params.length}`);
      }
    }

    if (updateFields.length === 0) {
      return this;
    }

    params.push(this.id);
    const result = await query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    Object.assign(this, new Product(result.rows[0]));
    return this;
  }

  // Adjust stock (atomic operation)
  async adjustStock(quantity) {
    return transaction(async (client) => {
      // Lock the row for update
      const lockResult = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE',
        [this.id]
      );

      if (!lockResult.rows[0]) {
        throw new Error('Product not found');
      }

      const currentStock = lockResult.rows[0].stock_quantity;
      const newStock = currentStock + quantity;

      if (newStock < 0) {
        throw new Error('Insufficient stock');
      }

      const updateResult = await client.query(
        'UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *',
        [newStock, this.id]
      );

      Object.assign(this, new Product(updateResult.rows[0]));
      return this;
    });
  }

  // Check if user can modify this product
  canBeModifiedBy(userId) {
    return this.createdBy === userId;
  }

  // Delete product (soft delete)
  async delete() {
    const result = await query(
      'UPDATE products SET is_available = false WHERE id = $1 RETURNING *',
      [this.id]
    );

    Object.assign(this, new Product(result.rows[0]));
    return this;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      sku: this.sku,
      category: this.category,
      tags: this.tags,
      stockQuantity: this.stockQuantity,
      isAvailable: this.isAvailable,
      createdBy: this.createdBy,
      createdByEmail: this.createdByEmail,
      createdByName: this.createdByName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Product;