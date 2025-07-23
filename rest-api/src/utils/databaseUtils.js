/**
 * Database Utility Functions
 * Provides common database operations, validation, and helper functions
 */

import { Database } from '../config/database.js';

export class DatabaseUtils {
  /**
   * Validate database connection
   */
  static async validateConnection() {
    try {
      const result = await Database.get('SELECT 1 as test');
      return result.test === 1;
    } catch (error) {
      console.error('Database connection validation failed:', error);
      return false;
    }
  }

  /**
   * Check if table exists
   */
  static async tableExists(tableName) {
    try {
      const result = await Database.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [tableName]
      );
      return !!result;
    } catch (error) {
      console.error(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Get table schema information
   */
  static async getTableSchema(tableName) {
    try {
      const schema = await Database.query(`PRAGMA table_info(${tableName})`);
      return schema.map(column => ({
        name: column.name,
        type: column.type,
        notNull: !!column.notnull,
        primaryKey: !!column.pk,
        defaultValue: column.dflt_value
      }));
    } catch (error) {
      console.error(`Error getting schema for table ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Get all table names
   */
  static async getAllTables() {
    try {
      const tables = await Database.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );
      return tables.map(table => table.name);
    } catch (error) {
      console.error('Error getting table list:', error);
      return [];
    }
  }

  /**
   * Get table row count
   */
  static async getTableRowCount(tableName) {
    try {
      const result = await Database.get(`SELECT COUNT(*) as count FROM ${tableName}`);
      return result.count;
    } catch (error) {
      console.error(`Error getting row count for table ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Get database file size
   */
  static async getDatabaseSize() {
    try {
      const result = await Database.get(
        `SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`
      );
      return result.size;
    } catch (error) {
      console.error('Error getting database size:', error);
      return 0;
    }
  }

  /**
   * Get database statistics
   */
  static async getDatabaseStats() {
    try {
      const tables = await this.getAllTables();
      const stats = {
        tables: {},
        totalSize: await this.getDatabaseSize(),
        totalTables: tables.length,
        totalRows: 0
      };

      for (const tableName of tables) {
        const rowCount = await this.getTableRowCount(tableName);
        stats.tables[tableName] = {
          rowCount,
          schema: await this.getTableSchema(tableName)
        };
        stats.totalRows += rowCount;
      }

      return stats;
    } catch (error) {
      console.error('Error getting database statistics:', error);
      return null;
    }
  }

  /**
   * Execute query with transaction
   */
  static async executeInTransaction(queries) {
    const connection = Database.getConnection();
    
    try {
      await Database.run('BEGIN TRANSACTION');
      
      const results = [];
      for (const { sql, params = [] } of queries) {
        const result = await Database.run(sql, params);
        results.push(result);
      }
      
      await Database.run('COMMIT');
      return results;
    } catch (error) {
      await Database.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Bulk insert with transaction
   */
  static async bulkInsert(tableName, data, chunkSize = 1000) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    try {
      await Database.run('BEGIN TRANSACTION');
      
      let inserted = 0;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        for (const row of chunk) {
          const values = columns.map(col => row[col]);
          await Database.run(sql, values);
          inserted++;
        }
      }
      
      await Database.run('COMMIT');
      return inserted;
    } catch (error) {
      await Database.run('ROLLBACK');
      throw new Error(`Bulk insert failed: ${error.message}`);
    }
  }

  /**
   * Search across multiple tables
   */
  static async globalSearch(searchTerm, tables = ['posts', 'users', 'comments'], limit = 20) {
    const results = {};
    const searchPattern = `%${searchTerm}%`;

    try {
      // Search posts
      if (tables.includes('posts')) {
        results.posts = await Database.query(`
          SELECT id, title, excerpt, created_at, 'post' as type
          FROM posts 
          WHERE title LIKE ? OR content LIKE ? OR excerpt LIKE ?
          ORDER BY created_at DESC
          LIMIT ?
        `, [searchPattern, searchPattern, searchPattern, limit]);
      }

      // Search users
      if (tables.includes('users')) {
        results.users = await Database.query(`
          SELECT id, username, first_name, last_name, bio, 'user' as type
          FROM users 
          WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR bio LIKE ?
          AND is_active = 1
          LIMIT ?
        `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);
      }

      // Search comments
      if (tables.includes('comments')) {
        results.comments = await Database.query(`
          SELECT c.id, c.content, c.created_at, p.title as post_title, 'comment' as type
          FROM comments c
          JOIN posts p ON c.post_id = p.id
          WHERE c.content LIKE ? AND c.is_approved = 1
          ORDER BY c.created_at DESC
          LIMIT ?
        `, [searchPattern, limit]);
      }

      return results;
    } catch (error) {
      console.error('Global search failed:', error);
      throw error;
    }
  }

  /**
   * Get foreign key violations
   */
  static async checkForeignKeyConstraints() {
    try {
      const violations = await Database.query('PRAGMA foreign_key_check');
      return violations;
    } catch (error) {
      console.error('Error checking foreign key constraints:', error);
      return [];
    }
  }

  /**
   * Optimize database performance
   */
  static async optimizeDatabase() {
    try {
      console.log('Starting database optimization...');
      
      // Update table statistics
      await Database.run('ANALYZE');
      
      // Rebuild database to reclaim space
      await Database.run('VACUUM');
      
      // Optimize indexes
      await Database.run('REINDEX');
      
      console.log('Database optimization completed');
      return true;
    } catch (error) {
      console.error('Database optimization failed:', error);
      return false;
    }
  }

  /**
   * Create database backup
   */
  static async createBackup(backupPath) {
    try {
      await Database.run(`VACUUM INTO '${backupPath}'`);
      console.log(`Database backup created: ${backupPath}`);
      return true;
    } catch (error) {
      console.error('Database backup failed:', error);
      return false;
    }
  }

  /**
   * Restore database from backup
   */
  static async restoreFromBackup(backupPath) {
    try {
      // This would require careful implementation in production
      console.warn('Database restore should be handled carefully in production');
      return false;
    } catch (error) {
      console.error('Database restore failed:', error);
      return false;
    }
  }

  /**
   * Clean up old data
   */
  static async cleanupOldData(options = {}) {
    const {
      deleteOldSessions = true,
      deleteExpiredTokens = true,
      deleteOldLogs = true,
      daysToKeep = 30
    } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.toISOString();

    try {
      await Database.run('BEGIN TRANSACTION');
      
      let cleanedRows = 0;

      if (deleteOldSessions) {
        const result = await Database.run(
          'DELETE FROM user_sessions WHERE created_at < ? AND is_active = 0',
          [cutoffTimestamp]
        );
        cleanedRows += result.changes || 0;
      }

      if (deleteExpiredTokens) {
        const result = await Database.run(
          'DELETE FROM refresh_tokens WHERE expires_at < ?',
          [new Date().toISOString()]
        );
        cleanedRows += result.changes || 0;
      }

      if (deleteOldLogs) {
        const result = await Database.run(
          'DELETE FROM audit_logs WHERE created_at < ?',
          [cutoffTimestamp]
        );
        cleanedRows += result.changes || 0;
      }

      await Database.run('COMMIT');
      
      console.log(`Cleanup completed: ${cleanedRows} rows removed`);
      return cleanedRows;
    } catch (error) {
      await Database.run('ROLLBACK');
      console.error('Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Generate database documentation
   */
  static async generateDocumentation() {
    try {
      const tables = await this.getAllTables();
      const documentation = {
        generated: new Date().toISOString(),
        database: {
          size: await this.getDatabaseSize(),
          tables: tables.length
        },
        tables: {}
      };

      for (const tableName of tables) {
        const schema = await this.getTableSchema(tableName);
        const rowCount = await this.getTableRowCount(tableName);
        
        documentation.tables[tableName] = {
          rowCount,
          columns: schema,
          foreignKeys: await this.getForeignKeys(tableName),
          indexes: await this.getTableIndexes(tableName)
        };
      }

      return documentation;
    } catch (error) {
      console.error('Error generating documentation:', error);
      return null;
    }
  }

  /**
   * Get foreign keys for a table
   */
  static async getForeignKeys(tableName) {
    try {
      const foreignKeys = await Database.query(`PRAGMA foreign_key_list(${tableName})`);
      return foreignKeys.map(fk => ({
        column: fk.from,
        referencesTable: fk.table,
        referencesColumn: fk.to,
        onDelete: fk.on_delete,
        onUpdate: fk.on_update
      }));
    } catch (error) {
      console.error(`Error getting foreign keys for ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Get indexes for a table
   */
  static async getTableIndexes(tableName) {
    try {
      const indexes = await Database.query(`PRAGMA index_list(${tableName})`);
      const indexDetails = [];
      
      for (const index of indexes) {
        const indexInfo = await Database.query(`PRAGMA index_info(${index.name})`);
        indexDetails.push({
          name: index.name,
          unique: !!index.unique,
          columns: indexInfo.map(info => info.name)
        });
      }
      
      return indexDetails;
    } catch (error) {
      console.error(`Error getting indexes for ${tableName}:`, error);
      return [];
    }
  }
}

export default DatabaseUtils;