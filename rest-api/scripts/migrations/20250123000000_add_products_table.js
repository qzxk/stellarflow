export default {
  up: async (db) => {
    // Create products table
    await db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
        stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
        category_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        sku VARCHAR(50) UNIQUE,
        image_url TEXT,
        weight DECIMAL(10, 2),
        dimensions VARCHAR(100),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    // Create indexes for better performance
    await db.run('CREATE INDEX idx_products_name ON products(name)');
    await db.run('CREATE INDEX idx_products_price ON products(price)');
    await db.run('CREATE INDEX idx_products_category_id ON products(category_id)');
    await db.run('CREATE INDEX idx_products_created_by ON products(created_by)');
    await db.run('CREATE INDEX idx_products_is_active ON products(is_active)');
    await db.run('CREATE INDEX idx_products_sku ON products(sku)');
    await db.run('CREATE INDEX idx_products_created_at ON products(created_at DESC)');

    // Create trigger to update updated_at
    await db.run(`
      CREATE TRIGGER update_products_updated_at
      AFTER UPDATE ON products
      FOR EACH ROW
      BEGIN
        UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    console.log('✅ Products table created successfully');
  },

  down: async (db) => {
    // Drop trigger
    await db.run('DROP TRIGGER IF EXISTS update_products_updated_at');
    
    // Drop indexes
    await db.run('DROP INDEX IF EXISTS idx_products_name');
    await db.run('DROP INDEX IF EXISTS idx_products_price');
    await db.run('DROP INDEX IF EXISTS idx_products_category_id');
    await db.run('DROP INDEX IF EXISTS idx_products_created_by');
    await db.run('DROP INDEX IF EXISTS idx_products_is_active');
    await db.run('DROP INDEX IF EXISTS idx_products_sku');
    await db.run('DROP INDEX IF EXISTS idx_products_created_at');
    
    // Drop table
    await db.run('DROP TABLE IF EXISTS products');
    
    console.log('✅ Products table dropped successfully');
  }
};