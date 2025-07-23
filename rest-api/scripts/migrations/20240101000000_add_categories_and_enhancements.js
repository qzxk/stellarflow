/**
 * Migration: Add categories and database enhancements
 * Created: 2024-01-01T00:00:00.000Z
 */

export async function up(database) {
  console.log('Running migration: Add categories and enhancements');

  // Add new columns to users table
  await database.run(`
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0
  `);
  
  await database.run(`
    ALTER TABLE users ADD COLUMN last_login DATETIME
  `);
  
  await database.run(`
    ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0
  `);

  console.log('✅ Enhanced users table');

  // Add new columns to posts table
  await database.run(`
    ALTER TABLE posts ADD COLUMN slug VARCHAR(200) UNIQUE
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN category_id INTEGER REFERENCES categories(id)
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN featured_image_alt TEXT
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN meta_title VARCHAR(200)
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN meta_description VARCHAR(300)
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN reading_time INTEGER
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN is_featured BOOLEAN DEFAULT 0
  `);
  
  await database.run(`
    ALTER TABLE posts ADD COLUMN published_at DATETIME
  `);

  console.log('✅ Enhanced posts table');

  // Add new columns to refresh_tokens table
  await database.run(`
    ALTER TABLE refresh_tokens ADD COLUMN is_revoked BOOLEAN DEFAULT 0
  `);
  
  await database.run(`
    ALTER TABLE refresh_tokens ADD COLUMN device_info TEXT
  `);
  
  await database.run(`
    ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45)
  `);
  
  await database.run(`
    ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME
  `);

  console.log('✅ Enhanced refresh_tokens table');

  // Create new tables
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

  await database.run(createCategoriesTable);
  console.log('✅ Created categories table');

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

  await database.run(createPostCategoriesTable);
  console.log('✅ Created post_categories table');

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

  await database.run(createUserSessionsTable);
  console.log('✅ Created user_sessions table');

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

  await database.run(createPostLikesTable);
  console.log('✅ Created post_likes table');

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

  await database.run(createAuditLogsTable);
  console.log('✅ Created audit_logs table');

  // Create additional indexes
  const additionalIndexes = `
    -- Category indexes
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
    
    -- Enhanced post indexes
    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at);
    CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(is_featured);
    CREATE INDEX IF NOT EXISTS idx_posts_title_search ON posts(title);
    
    -- Enhanced user indexes
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
    
    -- Enhanced comment indexes
    CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(is_approved);
    CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
    
    -- Session and security indexes
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
  `;

  await database.exec(additionalIndexes);
  console.log('✅ Created additional indexes');

  console.log('🎉 Migration completed successfully');
}

export async function down(database) {
  console.log('Rolling back migration: Add categories and enhancements');

  // Drop new tables (in reverse order due to foreign keys)
  await database.run('DROP TABLE IF EXISTS audit_logs');
  await database.run('DROP TABLE IF EXISTS post_likes');
  await database.run('DROP TABLE IF EXISTS user_sessions');
  await database.run('DROP TABLE IF EXISTS post_categories');
  await database.run('DROP TABLE IF EXISTS categories');

  console.log('✅ Dropped new tables');

  // Note: SQLite doesn't support DROP COLUMN, so we can't remove the added columns
  // In a real migration system, you might need to recreate tables without the columns
  console.log('⚠️  Note: SQLite does not support dropping columns. Added columns remain.');

  console.log('🎉 Migration rollback completed');
}