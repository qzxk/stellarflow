import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

/**
 * SQLite Connection Pool Implementation
 * Manages multiple database connections for better performance
 */
class SQLiteConnectionPool {
  constructor(options = {}) {
    this.dbPath = options.dbPath || process.env.DB_PATH || './data/stellarflow.db';
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    this.idleTimeout = options.idleTimeout || 30000; // 30 seconds
    this.acquireTimeout = options.acquireTimeout || 10000; // 10 seconds
    
    this.pool = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
    this.isDestroyed = false;
    
    this.stats = {
      totalConnections: 0,
      activeCount: 0,
      idleCount: 0,
      waitingCount: 0,
      totalAcquires: 0,
      totalReleases: 0,
      totalTimeouts: 0,
      totalErrors: 0
    };
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Create minimum connections
      for (let i = 0; i < this.minConnections; i++) {
        const connection = await this.createConnection();
        this.pool.push({
          connection,
          lastUsed: Date.now(),
          inUse: false
        });
      }

      // Start cleanup interval
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 30000); // Clean up every 30 seconds

      console.log(`SQLite connection pool initialized with ${this.minConnections} connections`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      throw error;
    }
  }

  async createConnection() {
    try {
      const db = new sqlite3.Database(this.dbPath);
      
      // Promisify methods
      db.getAsync = promisify(db.get.bind(db));
      db.allAsync = promisify(db.all.bind(db));
      db.runAsync = promisify(db.run.bind(db));
      db.execAsync = promisify(db.exec.bind(db));
      db.closeAsync = promisify(db.close.bind(db));

      // Configure SQLite for better performance and concurrency
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -64000;
        PRAGMA temp_store = MEMORY;
        PRAGMA mmap_size = 268435456;
      `);

      this.stats.totalConnections++;
      return db;
    } catch (error) {
      this.stats.totalErrors++;
      throw new Error(`Failed to create database connection: ${error.message}`);
    }
  }

  async acquire() {
    if (this.isDestroyed) {
      throw new Error('Connection pool has been destroyed');
    }

    this.stats.totalAcquires++;
    this.stats.waitingCount++;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const timeout = setTimeout(() => {
        this.stats.totalTimeouts++;
        this.stats.waitingCount--;
        reject(new Error('Connection acquire timeout'));
      }, this.acquireTimeout);

      const tryAcquire = async () => {
        try {
          // Look for idle connection
          const idleConnectionIndex = this.pool.findIndex(conn => !conn.inUse);
          
          if (idleConnectionIndex !== -1) {
            const poolConnection = this.pool[idleConnectionIndex];
            poolConnection.inUse = true;
            poolConnection.lastUsed = Date.now();
            
            this.activeConnections.add(poolConnection);
            this.updateStats();
            
            clearTimeout(timeout);
            this.stats.waitingCount--;
            resolve(poolConnection.connection);
            return;
          }

          // Create new connection if under max limit
          if (this.pool.length < this.maxConnections) {
            const connection = await this.createConnection();
            const poolConnection = {
              connection,
              lastUsed: Date.now(),
              inUse: true
            };
            
            this.pool.push(poolConnection);
            this.activeConnections.add(poolConnection);
            this.updateStats();
            
            clearTimeout(timeout);
            this.stats.waitingCount--;
            resolve(connection);
            return;
          }

          // Add to waiting queue
          this.waitingQueue.push({ resolve, reject, timeout, startTime });
        } catch (error) {
          clearTimeout(timeout);
          this.stats.waitingCount--;
          this.stats.totalErrors++;
          reject(error);
        }
      };

      tryAcquire();
    });
  }

  async release(connection) {
    if (this.isDestroyed) {
      return;
    }

    const poolConnection = this.pool.find(conn => conn.connection === connection);
    if (!poolConnection) {
      console.warn('Attempted to release connection not in pool');
      return;
    }

    poolConnection.inUse = false;
    poolConnection.lastUsed = Date.now();
    this.activeConnections.delete(poolConnection);
    this.stats.totalReleases++;
    this.updateStats();

    // Process waiting queue
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      poolConnection.inUse = true;
      poolConnection.lastUsed = Date.now();
      this.activeConnections.add(poolConnection);
      
      clearTimeout(waiting.timeout);
      this.stats.waitingCount--;
      waiting.resolve(connection);
    }
  }

  cleanup() {
    if (this.isDestroyed) {
      return;
    }

    const now = Date.now();
    const connectionsToRemove = [];

    // Find idle connections that have timed out
    for (let i = 0; i < this.pool.length; i++) {
      const poolConnection = this.pool[i];
      
      if (!poolConnection.inUse && 
          (now - poolConnection.lastUsed) > this.idleTimeout &&
          this.pool.length > this.minConnections) {
        connectionsToRemove.push(i);
      }
    }

    // Remove idle connections
    for (let i = connectionsToRemove.length - 1; i >= 0; i--) {
      const index = connectionsToRemove[i];
      const poolConnection = this.pool[index];
      
      try {
        poolConnection.connection.closeAsync();
        this.pool.splice(index, 1);
        this.stats.totalConnections--;
      } catch (error) {
        console.error('Error closing idle connection:', error);
      }
    }

    this.updateStats();
  }

  updateStats() {
    this.stats.activeCount = this.activeConnections.size;
    this.stats.idleCount = this.pool.length - this.stats.activeCount;
  }

  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  async execute(query, params = []) {
    const connection = await this.acquire();
    try {
      return await connection.runAsync(query, params);
    } finally {
      await this.release(connection);
    }
  }

  async get(query, params = []) {
    const connection = await this.acquire();
    try {
      return await connection.getAsync(query, params);
    } finally {
      await this.release(connection);
    }
  }

  async all(query, params = []) {
    const connection = await this.acquire();
    try {
      return await connection.allAsync(query, params);
    } finally {
      await this.release(connection);
    }
  }

  async transaction(callback) {
    const connection = await this.acquire();
    try {
      await connection.runAsync('BEGIN TRANSACTION');
      const result = await callback(connection);
      await connection.runAsync('COMMIT');
      return result;
    } catch (error) {
      await connection.runAsync('ROLLBACK');
      throw error;
    } finally {
      await this.release(connection);
    }
  }

  async destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject waiting connections
    this.waitingQueue.forEach(waiting => {
      clearTimeout(waiting.timeout);
      waiting.reject(new Error('Connection pool destroyed'));
    });
    this.waitingQueue = [];

    // Close all connections
    const closePromises = this.pool.map(poolConnection => {
      return poolConnection.connection.closeAsync().catch(error => {
        console.error('Error closing connection:', error);
      });
    });

    await Promise.allSettled(closePromises);
    this.pool = [];
    this.activeConnections.clear();
    
    console.log('SQLite connection pool destroyed');
  }

  async healthCheck() {
    try {
      const result = await this.get('SELECT 1 as health');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: this.getStats()
      };
    }
  }
}

// Create singleton instance
const connectionPool = new SQLiteConnectionPool({
  dbPath: process.env.DB_PATH,
  maxConnections: parseInt(process.env.DB_POOL_MAX) || 10,
  minConnections: parseInt(process.env.DB_POOL_MIN) || 2,
  idleTimeout: 30000,
  acquireTimeout: 10000
});

export { connectionPool as ConnectionPool };
export default SQLiteConnectionPool;