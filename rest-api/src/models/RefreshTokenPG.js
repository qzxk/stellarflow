import BaseModel from './BaseModel.js';
import { Database } from '../config/postgres.js';
import crypto from 'crypto';

class RefreshToken extends BaseModel {
  static get tableName() {
    return 'refresh_tokens';
  }

  static get columns() {
    return [
      'id', 'user_id', 'token_hash', 'expires_at', 'created_at',
      'used_at', 'revoked_at', 'user_agent', 'ip_address', 'device_id'
    ];
  }

  static get timestamps() {
    return false; // We handle timestamps manually for this model
  }

  // Convert to safe object
  toSafeObject() {
    return {
      id: this.id,
      user_id: this.user_id,
      expires_at: this.expires_at,
      created_at: this.created_at,
      used_at: this.used_at,
      revoked_at: this.revoked_at,
      user_agent: this.user_agent,
      ip_address: this.ip_address,
      device_id: this.device_id,
      is_active: this.isActive(),
      is_expired: this.isExpired(),
    };
  }

  // Generate a new refresh token
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash the token for storage
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Create a new refresh token
  static async create(data) {
    const tokenData = { ...data };
    
    // Generate and hash token if raw token provided
    if (data.token) {
      tokenData.token_hash = this.hashToken(data.token);
      delete tokenData.token;
    }

    // Set expiration if not provided (default 30 days)
    if (!tokenData.expires_at) {
      const expirationDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30');
      tokenData.expires_at = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
    }

    // Set created_at
    tokenData.created_at = new Date();

    return await super.create(tokenData);
  }

  // Find token by hashed value
  static async findByToken(token) {
    const tokenHash = this.hashToken(token);
    return await this.findOne({ token_hash: tokenHash });
  }

  // Find active tokens for a user
  static async findActiveByUserId(userId) {
    const query = `
      SELECT * FROM refresh_tokens
      WHERE user_id = $1
        AND expires_at > CURRENT_TIMESTAMP
        AND revoked_at IS NULL
        AND used_at IS NULL
      ORDER BY created_at DESC
    `;

    const results = await Database.all(query, [userId]);
    return results.map(row => new RefreshToken(row));
  }

  // Check if token is active
  isActive() {
    return !this.revoked_at && !this.used_at && !this.isExpired();
  }

  // Check if token is expired
  isExpired() {
    return new Date() > new Date(this.expires_at);
  }

  // Mark token as used
  async markAsUsed() {
    this.used_at = new Date();
    await RefreshToken.update({ id: this.id }, { used_at: this.used_at });
    return this;
  }

  // Revoke token
  async revoke() {
    this.revoked_at = new Date();
    await RefreshToken.update({ id: this.id }, { revoked_at: this.revoked_at });
    return this;
  }

  // Revoke all tokens for a user
  static async revokeAllForUser(userId) {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND revoked_at IS NULL
    `;

    const result = await Database.run(query, [userId]);
    return result.rowCount;
  }

  // Revoke all tokens for a device
  static async revokeAllForDevice(userId, deviceId) {
    const query = `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND device_id = $2
        AND revoked_at IS NULL
    `;

    const result = await Database.run(query, [userId, deviceId]);
    return result.rowCount;
  }

  // Clean up expired or used tokens
  static async cleanup() {
    const query = `
      DELETE FROM refresh_tokens
      WHERE expires_at < CURRENT_TIMESTAMP
        OR revoked_at IS NOT NULL
        OR used_at IS NOT NULL
    `;

    const result = await Database.run(query);
    return result.rowCount;
  }

  // Get token statistics for a user
  static async getStatsByUserId(userId) {
    const query = `
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN revoked_at IS NULL AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens,
        COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_tokens,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used_tokens,
        COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_tokens,
        COUNT(DISTINCT device_id) as unique_devices,
        COUNT(DISTINCT ip_address) as unique_ips,
        MIN(created_at) as first_token_created,
        MAX(created_at) as last_token_created
      FROM refresh_tokens
      WHERE user_id = $1
    `;

    return await Database.get(query, [userId]);
  }

  // Get active sessions (tokens) with details
  static async getActiveSessions(userId) {
    const query = `
      SELECT 
        id,
        device_id,
        user_agent,
        ip_address,
        created_at,
        expires_at,
        CASE 
          WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'just_now'
          WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 'today'
          WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'this_week'
          WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'this_month'
          ELSE 'older'
        END as created_relative
      FROM refresh_tokens
      WHERE user_id = $1
        AND expires_at > CURRENT_TIMESTAMP
        AND revoked_at IS NULL
        AND used_at IS NULL
      ORDER BY created_at DESC
    `;

    const results = await Database.all(query, [userId]);
    return results.map(row => new RefreshToken(row));
  }

  // Validate token and get associated user
  static async validateAndGetUser(token) {
    const refreshToken = await this.findByToken(token);
    
    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    if (!refreshToken.isActive()) {
      throw new Error('Refresh token is no longer active');
    }

    // Get the associated user
    const query = `
      SELECT u.*
      FROM users u
      WHERE u.id = $1
        AND u.is_active = true
    `;

    const user = await Database.get(query, [refreshToken.user_id]);
    
    if (!user) {
      throw new Error('User not found or inactive');
    }

    return { refreshToken, user };
  }

  // Rotate token (create new, mark old as used)
  static async rotate(oldToken, metadata = {}) {
    return await Database.transaction(async (client) => {
      // Find and validate old token
      const oldRefreshToken = await this.findByToken(oldToken);
      
      if (!oldRefreshToken) {
        throw new Error('Invalid refresh token');
      }

      if (!oldRefreshToken.isActive()) {
        // Token reuse detected - revoke all tokens for this user
        await this.revokeAllForUser(oldRefreshToken.user_id);
        throw new Error('Token reuse detected - all tokens revoked');
      }

      // Mark old token as used
      await client.query(
        'UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [oldRefreshToken.id]
      );

      // Create new token
      const newToken = this.generateToken();
      const newTokenData = {
        user_id: oldRefreshToken.user_id,
        token_hash: this.hashToken(newToken),
        expires_at: new Date(Date.now() + parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30') * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        user_agent: metadata.user_agent || oldRefreshToken.user_agent,
        ip_address: metadata.ip_address || oldRefreshToken.ip_address,
        device_id: metadata.device_id || oldRefreshToken.device_id,
      };

      const result = await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, user_agent, ip_address, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          newTokenData.user_id,
          newTokenData.token_hash,
          newTokenData.expires_at,
          newTokenData.created_at,
          newTokenData.user_agent,
          newTokenData.ip_address,
          newTokenData.device_id,
        ]
      );

      return {
        token: newToken,
        refreshToken: new RefreshToken(result.rows[0]),
      };
    });
  }

  // Get global token statistics
  static async getGlobalStats() {
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN revoked_at IS NULL AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_tokens,
        COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_tokens,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used_tokens,
        COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_tokens,
        AVG(EXTRACT(EPOCH FROM (COALESCE(revoked_at, used_at, expires_at) - created_at)) / 3600)::numeric(10,2) as avg_token_lifetime_hours
      FROM refresh_tokens
    `;

    return await Database.get(query);
  }
}

export default RefreshToken;