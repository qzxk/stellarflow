import BaseModel from './BaseModel.js';
import { Database } from '../config/postgres.js';

class Product extends BaseModel {
  static get tableName() {
    return 'products';
  }

  static get columns() {
    return [
      'id', 'name', 'description', 'price', 'sku', 'category',
      'tags', 'stock_quantity', 'is_available', 'created_by',
      'created_at', 'updated_at'
    ];
  }

  // Validation rules
  validate() {
    const errors = [];

    if (!this.name || this.name.trim() === '') {
      errors.push({ field: 'name', message: 'Product name is required' });
    } else if (this.name.length > 255) {
      errors.push({ field: 'name', message: 'Product name must not exceed 255 characters' });
    }

    if (this.price === undefined || this.price === null) {
      errors.push({ field: 'price', message: 'Price is required' });
    } else if (this.price < 0) {
      errors.push({ field: 'price', message: 'Price must be non-negative' });
    }

    if (this.stock_quantity !== undefined && this.stock_quantity < 0) {
      errors.push({ field: 'stock_quantity', message: 'Stock quantity must be non-negative' });
    }

    if (!this.created_by) {
      errors.push({ field: 'created_by', message: 'Creator ID is required' });
    }

    if (this.sku && this.sku.length > 100) {
      errors.push({ field: 'sku', message: 'SKU must not exceed 100 characters' });
    }

    if (this.category && this.category.length > 100) {
      errors.push({ field: 'category', message: 'Category must not exceed 100 characters' });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Convert to safe object (exclude sensitive data)
  toSafeObject() {
    const obj = this.toJSON();
    // All product fields are safe to return
    return obj;
  }

  // Find product by SKU
  static async findBySku(sku) {
    return await this.findOne({ sku });
  }

  // Find all products with advanced filtering
  static async findAllWithFilters(options = {}) {
    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
      tags,
      inStockOnly = false,
      isAvailable = true,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build conditions
    if (isAvailable !== undefined) {
      conditions.push(`is_available = $${paramIndex++}`);
      params.push(isAvailable);
    }

    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (minPrice !== undefined) {
      conditions.push(`price >= $${paramIndex++}`);
      params.push(minPrice);
    }

    if (maxPrice !== undefined) {
      conditions.push(`price <= $${paramIndex++}`);
      params.push(maxPrice);
    }

    if (inStockOnly) {
      conditions.push('stock_quantity > 0');
    }

    if (search) {
      conditions.push(`(
        name ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR 
        sku ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      // Check if any of the provided tags exist in the product's tags array
      const tagConditions = tags.map(() => `$${paramIndex++} = ANY(tags)`).join(' OR ');
      conditions.push(`(${tagConditions})`);
      params.push(...tags);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['name', 'price', 'created_at', 'updated_at', 'stock_quantity', 'category'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM products ${whereClause}`;
    const { count } = await Database.get(countQuery, params);

    // Get products with user information
    const query = `
      SELECT 
        p.*,
        u.email as created_by_email,
        u.full_name as created_by_name
      FROM products p
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const products = await Database.all(query, params);

    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  // Update stock quantity
  async updateStock(quantity, operation = 'set') {
    let query;
    const params = [quantity, this.id];

    switch (operation) {
      case 'increment':
        query = `
          UPDATE products 
          SET stock_quantity = stock_quantity + $1, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2 
          RETURNING stock_quantity
        `;
        break;
      case 'decrement':
        query = `
          UPDATE products 
          SET stock_quantity = GREATEST(0, stock_quantity - $1), 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2 
          RETURNING stock_quantity
        `;
        break;
      default: // 'set'
        query = `
          UPDATE products 
          SET stock_quantity = $1, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2 
          RETURNING stock_quantity
        `;
    }

    const result = await Database.get(query, params);
    this.stock_quantity = result.stock_quantity;
    return this;
  }

  // Check if product is in stock
  isInStock() {
    return this.stock_quantity > 0;
  }

  // Get products by category
  static async findByCategory(category, options = {}) {
    return this.findAllWithFilters({ ...options, category });
  }

  // Get low stock products
  static async findLowStock(threshold = 10, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE stock_quantity <= $1 AND stock_quantity > 0 AND is_available = true
    `;
    const { count } = await Database.get(countQuery, [threshold]);

    const query = `
      SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
      FROM products p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.stock_quantity <= $1 AND p.stock_quantity > 0 AND p.is_available = true
      ORDER BY p.stock_quantity ASC, p.name ASC
      LIMIT $2 OFFSET $3
    `;

    const products = await Database.all(query, [threshold, limit, offset]);

    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  // Get out of stock products
  static async findOutOfStock(options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE stock_quantity = 0 AND is_available = true
    `;
    const { count } = await Database.get(countQuery);

    const query = `
      SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
      FROM products p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.stock_quantity = 0 AND p.is_available = true
      ORDER BY p.updated_at DESC
      LIMIT $1 OFFSET $2
    `;

    const products = await Database.all(query, [limit, offset]);

    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  // Get product statistics
  static async getStatistics(userId = null) {
    let baseCondition = 'WHERE is_available = true';
    const params = [];
    let paramIndex = 1;

    if (userId) {
      baseCondition += ` AND created_by = $${paramIndex++}`;
      params.push(userId);
    }

    const query = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(DISTINCT category) as total_categories,
        SUM(stock_quantity) as total_stock,
        AVG(price)::numeric(10,2) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity <= 10 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN stock_quantity > 10 THEN 1 END) as in_stock_count,
        SUM(price * stock_quantity)::numeric(10,2) as total_inventory_value
      FROM products ${baseCondition}
    `;

    const stats = await Database.get(query, params);
    
    // Get top categories
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as product_count,
        SUM(stock_quantity) as total_stock,
        AVG(price)::numeric(10,2) as average_price
      FROM products
      ${baseCondition}
      AND category IS NOT NULL
      GROUP BY category
      ORDER BY product_count DESC
      LIMIT 5
    `;

    const topCategories = await Database.all(categoryQuery, params);

    return {
      ...stats,
      top_categories: topCategories,
    };
  }

  // Search products with full-text search (if available)
  static async search(searchTerm, options = {}) {
    const { page = 1, limit = 10, isAvailable = true } = options;
    const offset = (page - 1) * limit;

    // Simple search using ILIKE for now
    // In production, consider using PostgreSQL's full-text search capabilities
    const countQuery = `
      SELECT COUNT(*) as count
      FROM products
      WHERE (
        name ILIKE $1 OR
        description ILIKE $1 OR
        sku ILIKE $1 OR
        category ILIKE $1 OR
        $1 = ANY(tags)
      )
      ${isAvailable !== undefined ? 'AND is_available = $2' : ''}
    `;

    const searchPattern = `%${searchTerm}%`;
    const countParams = [searchPattern];
    if (isAvailable !== undefined) {
      countParams.push(isAvailable);
    }

    const { count } = await Database.get(countQuery, countParams);

    const query = `
      SELECT p.*, u.email as created_by_email, u.full_name as created_by_name
      FROM products p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE (
        p.name ILIKE $1 OR
        p.description ILIKE $1 OR
        p.sku ILIKE $1 OR
        p.category ILIKE $1 OR
        $1 = ANY(p.tags)
      )
      ${isAvailable !== undefined ? 'AND p.is_available = $2' : ''}
      ORDER BY 
        CASE 
          WHEN p.name ILIKE $1 THEN 1
          WHEN p.sku ILIKE $1 THEN 2
          WHEN p.category ILIKE $1 THEN 3
          ELSE 4
        END,
        p.created_at DESC
      LIMIT ${isAvailable !== undefined ? '$3' : '$2'} 
      OFFSET ${isAvailable !== undefined ? '$4' : '$3'}
    `;

    const queryParams = [searchPattern];
    if (isAvailable !== undefined) {
      queryParams.push(isAvailable);
    }
    queryParams.push(limit, offset);

    const products = await Database.all(query, queryParams);

    return {
      products: products.map(p => new Product(p)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
      searchTerm,
    };
  }

  // Bulk update prices (e.g., for sales)
  static async bulkUpdatePrices(updates) {
    return await Database.transaction(async (client) => {
      const results = [];

      for (const update of updates) {
        const { id, price, percentage } = update;
        let query;
        let params;

        if (percentage !== undefined) {
          // Update by percentage
          query = `
            UPDATE products 
            SET price = price * (1 + $1 / 100.0), 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 
            RETURNING id, price
          `;
          params = [percentage, id];
        } else if (price !== undefined) {
          // Update to specific price
          query = `
            UPDATE products 
            SET price = $1, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 
            RETURNING id, price
          `;
          params = [price, id];
        } else {
          continue;
        }

        const result = await client.query(query, params);
        if (result.rows[0]) {
          results.push(result.rows[0]);
        }
      }

      return results;
    });
  }
}

export default Product;