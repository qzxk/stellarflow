import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

class Database {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DB_PATH || './data/stellarflow.db';
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Initialize SQLite database
      this.db = new sqlite3.Database(this.dbPath);
      
      // Promisify database methods
      this.db.getAsync = promisify(this.db.get.bind(this.db));
      this.db.allAsync = promisify(this.db.all.bind(this.db));
      this.db.runAsync = promisify(this.db.run.bind(this.db));
      this.db.execAsync = promisify(this.db.exec.bind(this.db));

      // Enable foreign keys
      await this.db.runAsync('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_url TEXT,
        bio TEXT,
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        last_login DATETIME,
        login_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        color VARCHAR(7),
        parent_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        post_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `;

    const createPostsTable = `
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(200) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        author_id INTEGER NOT NULL,
        category_id INTEGER,
        status VARCHAR(20) DEFAULT 'published',
        featured_image TEXT,
        featured_image_alt TEXT,
        tags TEXT,
        meta_title VARCHAR(200),
        meta_description VARCHAR(300),
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        reading_time INTEGER,
        is_featured BOOLEAN DEFAULT 0,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `;

    const createPostCategoriesTable = `
      CREATE TABLE IF NOT EXISTS post_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(post_id, category_id)
      )
    `;

    const createCommentsTable = `
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        post_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        parent_id INTEGER,
        is_approved BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `;

    const createRefreshTokensTable = `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        is_revoked BOOLEAN DEFAULT 0,
        device_info TEXT,
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        revoked_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createUserSessionsTable = `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        device_info TEXT,
        location TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createPostLikesTable = `
      CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      )
    `;

    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(100),
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createIndexes = `
      -- User indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
      
      -- Category indexes
      CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
      CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
      
      -- Post indexes
      CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
      CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
      CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(is_featured);
      CREATE INDEX IF NOT EXISTS idx_posts_title_search ON posts(title);
      
      -- Comment indexes
      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
      CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(is_approved);
      CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
      
      -- Session and security indexes
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(is_revoked);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
      
      -- Analytics indexes
      CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_post_categories_post ON post_categories(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_categories_category ON post_categories(category_id);
      
      -- Audit indexes
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
      
      -- Product indexes
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    `;

    try {
      // Create tables in correct order due to foreign key constraints
      await this.db.execAsync(createUsersTable);
      await this.db.execAsync(createCategoriesTable);
      await this.db.execAsync(createPostsTable);
      await this.db.execAsync(createCommentsTable);
      await this.db.execAsync(createPostCategoriesTable);
      await this.db.execAsync(createRefreshTokensTable);
      await this.db.execAsync(createUserSessionsTable);
      await this.db.execAsync(createPostLikesTable);
      await this.db.execAsync(createAuditLogsTable);
      await this.db.execAsync(createIndexes);
      
      console.log('Database tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      return await this.db.allAsync(sql, params);
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      return await this.db.getAsync(sql, params);
    } catch (error) {
      console.error('Database get error:', error);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      return await this.db.runAsync(sql, params);
    } catch (error) {
      console.error('Database run error:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      });
    }
  }

  getConnection() {
    return this.db;
  }

  // Database health check
  async healthCheck() {
    try {
      await this.db.getAsync('SELECT 1');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = {};
      
      // Get table counts
      const tables = ['users', 'posts', 'comments', 'categories', 'refresh_tokens', 'user_sessions'];
      for (const table of tables) {
        const result = await this.db.getAsync(`SELECT COUNT(*) as count FROM ${table}`);
        stats[`${table}_count`] = result.count;
      }
      
      // Get database size
      const sizeResult = await this.db.getAsync("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
      stats.database_size_bytes = sizeResult.size;
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error.message}`);
    }
  }

  // Optimize database
  async optimize() {
    try {
      await this.db.execAsync('VACUUM');
      await this.db.execAsync('ANALYZE');
      console.log('Database optimization completed');
    } catch (error) {
      console.error('Database optimization failed:', error);
      throw error;
    }
  }

  // Create database backup
  async backup(backupPath) {
    try {
      await this.db.execAsync(`VACUUM INTO '${backupPath}'`);
      console.log(`Database backup created at: ${backupPath}`);
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const database = new Database();

export { database as Database };