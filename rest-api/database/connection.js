const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'rest_api_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

// Connection test function
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected successfully at:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await client.query(schema);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Query helper with automatic client management
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production' && duration > 100) {
      console.log('Slow query detected:', {
        text,
        duration,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Set current user for audit logging
async function setCurrentUser(userId) {
  try {
    await pool.query(`SET LOCAL app.current_user_id = $1`, [userId]);
  } catch (error) {
    console.error('Failed to set current user for audit:', error);
  }
}

// Clean up expired tokens (run periodically)
async function cleanupExpiredTokens() {
  try {
    const result = await query('SELECT cleanup_expired_tokens()');
    const deletedCount = result.rows[0].cleanup_expired_tokens;
    console.log(`Cleaned up ${deletedCount} expired tokens`);
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
    return 0;
  }
}

// Graceful shutdown
async function shutdown() {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connections');
  await shutdown();
  process.exit(0);
});

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  initializeDatabase,
  setCurrentUser,
  cleanupExpiredTokens,
  shutdown
};