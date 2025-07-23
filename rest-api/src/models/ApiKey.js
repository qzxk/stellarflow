import crypto from 'crypto';
import { Database } from '../config/database.js';

class ApiKey {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.key_hash = data.key_hash;
    this.user_id = data.user_id;
    this.permissions = data.permissions ? JSON.parse(data.permissions) : [];
    this.rate_limit = data.rate_limit || 1000;
    this.expires_at = data.expires_at;
    this.last_used_at = data.last_used_at;
    this.is_active = data.is_active !== 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Generate a new API key
  static generateApiKey() {
    const prefix = 'sk_'; // Secret key prefix
    const randomBytes = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${randomBytes}`;
  }

  // Hash API key for storage
  static hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  // Create new API key
  static async create(data) {
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);
    
    const sql = `
      INSERT INTO api_keys (
        name, key_hash, user_id, permissions, rate_limit, 
        expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.name,
      keyHash,
      data.user_id,
      JSON.stringify(data.permissions || []),
      data.rate_limit || 1000,
      data.expires_at || null,
      1
    ];

    try {
      const result = await Database.run(sql, params);
      const newKey = await this.findById(result.lastID);
      
      // Return the actual API key only on creation
      return {
        apiKey: apiKey,
        keyData: newKey
      };
    } catch (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }
  }

  // Find API key by hash
  static async findByKeyHash(keyHash) {
    const sql = `
      SELECT ak.*, u.username, u.email, u.role as user_role
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.is_active = 1
        AND (ak.expires_at IS NULL OR ak.expires_at > datetime('now'))
    `;

    try {
      const row = await Database.get(sql, [keyHash]);
      return row ? new ApiKey(row) : null;
    } catch (error) {
      throw new Error(`Failed to find API key: ${error.message}`);
    }
  }

  // Find API key by actual key value
  static async findByKey(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    return this.findByKeyHash(keyHash);
  }

  // Find all keys for a user
  static async findByUserId(userId) {
    const sql = `
      SELECT * FROM api_keys 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `;

    try {
      const rows = await Database.query(sql, [userId]);
      return rows.map(row => new ApiKey(row));
    } catch (error) {
      throw new Error(`Failed to find user API keys: ${error.message}`);
    }
  }

  // Find by ID
  static async findById(id) {
    const sql = 'SELECT * FROM api_keys WHERE id = ?';

    try {
      const row = await Database.get(sql, [id]);
      return row ? new ApiKey(row) : null;
    } catch (error) {
      throw new Error(`Failed to find API key by ID: ${error.message}`);
    }
  }

  // Update last used timestamp
  async updateLastUsed() {
    const sql = `
      UPDATE api_keys 
      SET last_used_at = datetime('now') 
      WHERE id = ?
    `;

    try {
      await Database.run(sql, [this.id]);
      this.last_used_at = new Date().toISOString();
    } catch (error) {
      console.error('Failed to update last used:', error);
    }
  }

  // Revoke API key
  async revoke() {
    const sql = `
      UPDATE api_keys 
      SET is_active = 0, updated_at = datetime('now') 
      WHERE id = ?
    `;

    try {
      await Database.run(sql, [this.id]);
      this.is_active = false;
      return true;
    } catch (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  // Update API key
  async update(data) {
    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }

    if (data.rate_limit !== undefined) {
      updates.push('rate_limit = ?');
      values.push(data.rate_limit);
    }

    if (data.expires_at !== undefined) {
      updates.push('expires_at = ?');
      values.push(data.expires_at);
    }

    if (updates.length === 0) {
      return this;
    }

    updates.push('updated_at = datetime("now")');
    values.push(this.id);

    const sql = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`;

    try {
      await Database.run(sql, values);
      return ApiKey.findById(this.id);
    } catch (error) {
      throw new Error(`Failed to update API key: ${error.message}`);
    }
  }

  // Check if key has permission
  hasPermission(permission) {
    return this.permissions.includes('*') || this.permissions.includes(permission);
  }

  // Check if key is expired
  isExpired() {
    if (!this.expires_at) return false;
    return new Date(this.expires_at) < new Date();
  }

  // Clean up expired keys
  static async cleanupExpired() {
    const sql = `
      UPDATE api_keys 
      SET is_active = 0 
      WHERE expires_at < datetime('now') AND is_active = 1
    `;

    try {
      const result = await Database.run(sql);
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup expired API keys:', error);
      return 0;
    }
  }

  // Convert to safe object (no sensitive data)
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      permissions: this.permissions,
      rate_limit: this.rate_limit,
      expires_at: this.expires_at,
      last_used_at: this.last_used_at,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }
}

export default ApiKey;