import { Database } from '../config/database.js';

class ProductController {
  async getAll(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        sort = 'created_at', 
        order = 'DESC', 
        search, 
        category,
        minPrice,
        maxPrice,
        inStock
      } = req.query;
      
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];
      
      // Apply filters
      if (search) {
        query += ' AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }
      
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      
      if (minPrice) {
        query += ' AND price >= ?';
        params.push(parseFloat(minPrice));
      }
      
      if (maxPrice) {
        query += ' AND price <= ?';
        params.push(parseFloat(maxPrice));
      }
      
      if (inStock !== undefined) {
        query += ' AND stock_quantity > 0';
      }
      
      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const { total } = await Database.get(countQuery, params);
      
      // Apply sorting and pagination
      const validSortFields = ['name', 'price', 'stock_quantity', 'created_at', 'updated_at'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);
      
      const products = await Database.query(query, params);
      
      // Parse image URLs
      products.forEach(product => {
        if (product.image_urls) {
          product.image_urls = JSON.parse(product.image_urls);
        }
      });
      
      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      
      const product = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      // Parse image URLs
      if (product.image_urls) {
        product.image_urls = JSON.parse(product.image_urls);
      }
      
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async getBySku(req, res, next) {
    try {
      const { sku } = req.params;
      
      const product = await Database.get(
        'SELECT * FROM products WHERE sku = ?',
        [sku]
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      // Parse image URLs
      if (product.image_urls) {
        product.image_urls = JSON.parse(product.image_urls);
      }
      
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const {
        name,
        description,
        sku,
        price,
        category,
        stock_quantity = 0,
        image_urls = [],
        is_active = true
      } = req.body;
      
      // Check for duplicate SKU
      const existing = await Database.get(
        'SELECT id FROM products WHERE sku = ?',
        [sku]
      );
      
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Product with this SKU already exists'
        });
      }
      
      const result = await Database.run(
        `INSERT INTO products (
          name, description, sku, price, category, 
          stock_quantity, image_urls, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || null,
          sku,
          price,
          category || null,
          stock_quantity,
          JSON.stringify(image_urls),
          is_active ? 1 : 0
        ]
      );
      
      const product = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [result.lastID]
      );
      
      if (product.image_urls) {
        product.image_urls = JSON.parse(product.image_urls);
      }
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        sku,
        price,
        category,
        stock_quantity,
        image_urls,
        is_active
      } = req.body;
      
      // Check if product exists
      const product = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      // Check for SKU conflict if updating SKU
      if (sku && sku !== product.sku) {
        const conflict = await Database.get(
          'SELECT id FROM products WHERE sku = ? AND id != ?',
          [sku, id]
        );
        
        if (conflict) {
          return res.status(409).json({
            success: false,
            error: 'Product with this SKU already exists'
          });
        }
      }
      
      await Database.run(
        `UPDATE products SET 
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          sku = COALESCE(?, sku),
          price = COALESCE(?, price),
          category = COALESCE(?, category),
          stock_quantity = COALESCE(?, stock_quantity),
          image_urls = COALESCE(?, image_urls),
          is_active = COALESCE(?, is_active),
          updated_at = ?
        WHERE id = ?`,
        [
          name,
          description,
          sku,
          price,
          category,
          stock_quantity,
          image_urls ? JSON.stringify(image_urls) : null,
          is_active !== undefined ? (is_active ? 1 : 0) : null,
          new Date().toISOString(),
          id
        ]
      );
      
      const updatedProduct = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (updatedProduct.image_urls) {
        updatedProduct.image_urls = JSON.parse(updatedProduct.image_urls);
      }
      
      res.json({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if product exists
      const product = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      // Soft delete by deactivating
      await Database.run(
        'UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), id]
      );
      
      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStock(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity, operation = 'set' } = req.body;
      
      // Check if product exists
      const product = await Database.get(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }
      
      let newQuantity;
      switch (operation) {
        case 'add':
          newQuantity = product.stock_quantity + quantity;
          break;
        case 'subtract':
          newQuantity = Math.max(0, product.stock_quantity - quantity);
          break;
        case 'set':
        default:
          newQuantity = quantity;
          break;
      }
      
      await Database.run(
        'UPDATE products SET stock_quantity = ?, updated_at = ? WHERE id = ?',
        [newQuantity, new Date().toISOString(), id]
      );
      
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          id: product.id,
          sku: product.sku,
          previous_stock: product.stock_quantity,
          new_stock: newQuantity,
          operation
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req, res, next) {
    try {
      const categories = await Database.query(
        `SELECT DISTINCT category, COUNT(*) as product_count 
         FROM products 
         WHERE category IS NOT NULL AND is_active = 1
         GROUP BY category
         ORDER BY category`
      );
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  async searchProducts(req, res, next) {
    try {
      const { q, limit = 10 } = req.query;
      
      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters'
        });
      }
      
      const products = await Database.query(
        `SELECT * FROM products 
         WHERE is_active = 1 
           AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)
         ORDER BY 
           CASE 
             WHEN name LIKE ? THEN 1
             WHEN sku = ? THEN 2
             ELSE 3
           END,
           name
         LIMIT ?`,
        [
          `%${q}%`, `%${q}%`, `%${q}%`,
          `${q}%`, q,
          parseInt(limit)
        ]
      );
      
      // Parse image URLs
      products.forEach(product => {
        if (product.image_urls) {
          product.image_urls = JSON.parse(product.image_urls);
        }
      });
      
      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await Database.get(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
          COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock,
          COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity < 10 THEN 1 END) as low_stock,
          AVG(price) as average_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          SUM(stock_quantity) as total_stock_value,
          COUNT(DISTINCT category) as total_categories
        FROM products
      `);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProductController();