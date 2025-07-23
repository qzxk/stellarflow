import { Database } from '../config/postgres.js';

class BaseModel {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static get tableName() {
    throw new Error('tableName must be defined in subclass');
  }

  static get primaryKey() {
    return 'id';
  }

  static get columns() {
    throw new Error('columns must be defined in subclass');
  }

  static get timestamps() {
    return true;
  }

  // Build WHERE clause from conditions
  static buildWhereClause(conditions = {}, startIndex = 1) {
    const clauses = [];
    const params = [];
    let paramIndex = startIndex;

    Object.entries(conditions).forEach(([key, value]) => {
      if (value === null) {
        clauses.push(`${key} IS NULL`);
      } else if (value === undefined) {
        // Skip undefined values
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 5, $lt: 10 }
        Object.entries(value).forEach(([operator, val]) => {
          switch (operator) {
            case '$gt':
              clauses.push(`${key} > $${paramIndex++}`);
              params.push(val);
              break;
            case '$gte':
              clauses.push(`${key} >= $${paramIndex++}`);
              params.push(val);
              break;
            case '$lt':
              clauses.push(`${key} < $${paramIndex++}`);
              params.push(val);
              break;
            case '$lte':
              clauses.push(`${key} <= $${paramIndex++}`);
              params.push(val);
              break;
            case '$ne':
              clauses.push(`${key} != $${paramIndex++}`);
              params.push(val);
              break;
            case '$like':
              clauses.push(`${key} LIKE $${paramIndex++}`);
              params.push(val);
              break;
            case '$ilike':
              clauses.push(`${key} ILIKE $${paramIndex++}`);
              params.push(val);
              break;
            default:
              throw new Error(`Unknown operator: ${operator}`);
          }
        });
      } else {
        clauses.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    });

    return {
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
      nextIndex: paramIndex,
    };
  }

  // Create a new record
  static async create(data) {
    const columns = Object.keys(data).filter(key => this.columns.includes(key));
    const values = columns.map(col => data[col]);
    
    if (this.timestamps) {
      const now = new Date();
      if (!columns.includes('created_at')) {
        columns.push('created_at');
        values.push(now);
      }
      if (!columns.includes('updated_at')) {
        columns.push('updated_at');
        values.push(now);
      }
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const returningClause = `RETURNING *`;

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ${returningClause}
    `;

    const result = await Database.query(query, values);
    return new this(result.rows[0]);
  }

  // Find by primary key
  static async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    const result = await Database.get(query, [id]);
    return result ? new this(result) : null;
  }

  // Find one record by conditions
  static async findOne(conditions = {}) {
    const { whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const result = await Database.get(query, params);
    return result ? new this(result) : null;
  }

  // Find all records with conditions
  static async findAll(options = {}) {
    const {
      where = {},
      orderBy = `${this.primaryKey} DESC`,
      limit,
      offset,
      select = '*',
    } = options;

    const { whereClause, params, nextIndex } = this.buildWhereClause(where);
    let query = `SELECT ${select} FROM ${this.tableName} ${whereClause}`;

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      query += ` LIMIT $${nextIndex}`;
      params.push(limit);
      
      if (offset) {
        query += ` OFFSET $${nextIndex + 1}`;
        params.push(offset);
      }
    }

    const results = await Database.all(query, params);
    return results.map(row => new this(row));
  }

  // Count records
  static async count(conditions = {}) {
    const { whereClause, params } = this.buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const result = await Database.get(query, params);
    return parseInt(result.count);
  }

  // Update records
  static async update(conditions, data) {
    const updates = Object.keys(data)
      .filter(key => this.columns.includes(key))
      .map((key, index) => `${key} = $${index + 1}`);

    if (updates.length === 0) {
      return { rowCount: 0 };
    }

    const values = Object.keys(data)
      .filter(key => this.columns.includes(key))
      .map(key => data[key]);

    if (this.timestamps) {
      updates.push(`updated_at = $${values.length + 1}`);
      values.push(new Date());
    }

    const { whereClause, params } = this.buildWhereClause(conditions, values.length + 1);
    values.push(...params);

    const query = `UPDATE ${this.tableName} SET ${updates.join(', ')} ${whereClause}`;
    const result = await Database.run(query, values);
    return result;
  }

  // Delete records
  static async delete(conditions) {
    const { whereClause, params } = this.buildWhereClause(conditions);
    const query = `DELETE FROM ${this.tableName} ${whereClause}`;
    const result = await Database.run(query, params);
    return result;
  }

  // Instance methods
  async save() {
    const data = {};
    this.constructor.columns.forEach(col => {
      if (this[col] !== undefined) {
        data[col] = this[col];
      }
    });

    if (this[this.constructor.primaryKey]) {
      // Update existing record
      const conditions = { [this.constructor.primaryKey]: this[this.constructor.primaryKey] };
      await this.constructor.update(conditions, data);
      
      // Reload the instance
      const updated = await this.constructor.findById(this[this.constructor.primaryKey]);
      Object.assign(this, updated);
    } else {
      // Create new record
      const created = await this.constructor.create(data);
      Object.assign(this, created);
    }

    return this;
  }

  async delete() {
    if (!this[this.constructor.primaryKey]) {
      throw new Error('Cannot delete record without primary key');
    }

    const conditions = { [this.constructor.primaryKey]: this[this.constructor.primaryKey] };
    const result = await this.constructor.delete(conditions);
    return result.rowCount > 0;
  }

  // Convert to plain object
  toJSON() {
    const obj = {};
    this.constructor.columns.forEach(col => {
      if (this[col] !== undefined) {
        obj[col] = this[col];
      }
    });
    return obj;
  }

  // Validate data (to be overridden in subclasses)
  validate() {
    return { valid: true, errors: [] };
  }
}

export default BaseModel;