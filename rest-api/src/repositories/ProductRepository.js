import Product from '../models/ProductPG.js';
import { Database } from '../config/postgres.js';

class ProductRepository {
  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @returns {Promise<Product>} Created product
   */
  async create(productData) {
    const validation = new Product(productData).validate();
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.validationErrors = validation.errors;
      throw error;
    }

    return await Product.create(productData);
  }

  /**
   * Find product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Product|null>} Product or null
   */
  async findById(id) {
    return await Product.findById(id);
  }

  /**
   * Find product by SKU
   * @param {string} sku - Product SKU
   * @returns {Promise<Product|null>} Product or null
   */
  async findBySku(sku) {
    return await Product.findBySku(sku);
  }

  /**
   * Find all products with filters and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products and pagination info
   */
  async findAll(options = {}) {
    return await Product.findAllWithFilters(options);
  }

  /**
   * Update a product
   * @param {string} id - Product ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Product>} Updated product
   */
  async update(id, updateData) {
    const product = await this.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    // Validate update data
    const tempProduct = new Product({ ...product.toJSON(), ...updateData });
    const validation = tempProduct.validate();
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.validationErrors = validation.errors;
      throw error;
    }

    await Product.update({ id }, updateData);
    return await this.findById(id);
  }

  /**
   * Delete a product (soft delete)
   * @param {string} id - Product ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const product = await this.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    await Product.update({ id }, { is_available: false });
    return true;
  }

  /**
   * Hard delete a product
   * @param {string} id - Product ID
   * @returns {Promise<boolean>} Success status
   */
  async hardDelete(id) {
    const result = await Product.delete({ id });
    return result.rowCount > 0;
  }

  /**
   * Update product stock
   * @param {string} id - Product ID
   * @param {number} quantity - Quantity to update
   * @param {string} operation - Operation type (set, increment, decrement)
   * @returns {Promise<Product>} Updated product
   */
  async updateStock(id, quantity, operation = 'set') {
    const product = await this.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    return await product.updateStock(quantity, operation);
  }

  /**
   * Find products by category
   * @param {string} category - Category name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products and pagination info
   */
  async findByCategory(category, options = {}) {
    return await Product.findByCategory(category, options);
  }

  /**
   * Find low stock products
   * @param {number} threshold - Stock threshold
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products and pagination info
   */
  async findLowStock(threshold = 10, options = {}) {
    return await Product.findLowStock(threshold, options);
  }

  /**
   * Find out of stock products
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products and pagination info
   */
  async findOutOfStock(options = {}) {
    return await Product.findOutOfStock(options);
  }

  /**
   * Search products
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products and pagination info
   */
  async search(searchTerm, options = {}) {
    return await Product.search(searchTerm, options);
  }

  /**
   * Get product statistics
   * @param {string} userId - Optional user ID for filtered stats
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(userId = null) {
    return await Product.getStatistics(userId);
  }

  /**
   * Bulk update product prices
   * @param {Array} updates - Array of price updates
   * @returns {Promise<Array>} Updated products
   */
  async bulkUpdatePrices(updates) {
    return await Product.bulkUpdatePrices(updates);
  }

  /**
   * Check if SKU exists
   * @param {string} sku - SKU to check
   * @param {string} excludeId - ID to exclude from check
   * @returns {Promise<boolean>} True if exists
   */
  async skuExists(sku, excludeId = null) {
    const product = await Product.findBySku(sku);
    if (!product) return false;
    return excludeId ? product.id !== excludeId : true;
  }

  /**
   * Batch create products
   * @param {Array} productsData - Array of product data
   * @returns {Promise<Array>} Created products
   */
  async batchCreate(productsData) {
    return await Database.transaction(async (client) => {
      const products = [];
      
      for (const productData of productsData) {
        const validation = new Product(productData).validate();
        if (!validation.valid) {
          throw new Error(`Validation failed for product: ${JSON.stringify(validation.errors)}`);
        }

        const product = await Product.create(productData);
        products.push(product);
      }

      return products;
    });
  }

  /**
   * Get products with low stock alert
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Products needing restock
   */
  async getRestockAlert(options = {}) {
    const { threshold = 10, includeOutOfStock = true } = options;
    
    const lowStock = await this.findLowStock(threshold, options);
    const outOfStock = includeOutOfStock ? await this.findOutOfStock(options) : { products: [] };

    return {
      lowStock: lowStock.products,
      outOfStock: outOfStock.products,
      totalAlerts: lowStock.products.length + outOfStock.products.length,
      threshold
    };
  }

  /**
   * Archive old products
   * @param {Date} beforeDate - Archive products created before this date
   * @returns {Promise<number>} Number of archived products
   */
  async archiveOldProducts(beforeDate) {
    const result = await Product.update(
      { 
        created_at: { $lt: beforeDate },
        is_available: true
      },
      { is_available: false }
    );

    return result.rowCount;
  }
}

// Export singleton instance
export default new ProductRepository();