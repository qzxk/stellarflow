import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection configuration
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'stellarflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // How long a client is allowed to remain idle
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'), // How long to wait for a connection
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
};

class PostgresDatabase {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.pool = new Pool(poolConfig);
      
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      // Set up error handling
      this.pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
      });
      
      // Log pool events in development
      if (process.env.NODE_ENV === 'development') {
        this.pool.on('connect', () => {
          console.log('New client connected to database');
        });
        
        this.pool.on('acquire', () => {
          console.log('Client acquired from pool');
        });
        
        this.pool.on('remove', () => {
          console.log('Client removed from pool');
        });
      }
      
      this.isInitialized = true;
      console.log('PostgreSQL database initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize PostgreSQL database:', error);
      throw error;
    }
  }

  // Get a client from the pool for transactions
  async getClient() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  // Execute a single query
  async query(text, params = []) {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries in development
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.log('Slow query detected:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  // Get a single row
  async get(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  // Get all rows
  async all(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  // Run an insert/update/delete query
  async run(text, params = []) {
    const result = await this.query(text, params);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  }

  // Execute a transaction
  async transaction(callback) {
    const client = await this.getClient();
    
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

  // Batch insert
  async batchInsert(table, columns, values) {
    if (!values || values.length === 0) {
      return { rowCount: 0 };
    }

    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Build the query
      const placeholders = values.map((_, rowIndex) => 
        `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
      ).join(', ');
      
      const flatValues = values.flat();
      const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
      
      const result = await client.query(query, flatValues);
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Health check
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as timestamp, version() as version');
      return {
        status: 'healthy',
        timestamp: result.rows[0].timestamp,
        version: result.rows[0].version,
        poolStats: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = {};
      
      // Get table sizes
      const tableSizes = await this.all(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      
      stats.tables = tableSizes;
      
      // Get row counts
      const tables = ['users', 'products', 'refresh_tokens', 'audit_logs'];
      for (const table of tables) {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats[`${table}_count`] = parseInt(result.count);
      }
      
      // Get database size
      const dbSize = await this.get(`
        SELECT pg_database_size(current_database()) as size,
               pg_size_pretty(pg_database_size(current_database())) as size_pretty
      `);
      
      stats.database_size_bytes = parseInt(dbSize.size);
      stats.database_size = dbSize.size_pretty;
      
      // Get connection stats
      const connectionStats = await this.get(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      
      stats.connections = connectionStats;
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error.message}`);
    }
  }

  // Close the connection pool
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isInitialized = false;
      console.log('PostgreSQL connection pool closed');
    }
  }

  // Get the pool instance (for advanced use cases)
  getPool() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.pool;
  }
}

// Create singleton instance
const database = new PostgresDatabase();

export { database as Database };
export default database;