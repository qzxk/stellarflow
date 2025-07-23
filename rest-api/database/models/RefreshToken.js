const crypto = require('crypto');
const { query, transaction } = require('../connection');

class RefreshToken {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.tokenHash = data.token_hash;
    this.expiresAt = data.expires_at;
    this.createdAt = data.created_at;
    this.usedAt = data.used_at;
    this.revokedAt = data.revoked_at;
    this.userAgent = data.user_agent;
    this.ipAddress = data.ip_address;
    this.deviceId = data.device_id;
  }

  // Create a new refresh token
  static async create({ userId, userAgent, ipAddress, deviceId, expiresInDays = 30 }) {
    // Generate a secure random token
    const token = crypto.randomBytes(64).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address, device_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, tokenHash, expiresAt, userAgent, ipAddress, deviceId]
    );

    const refreshToken = new RefreshToken(result.rows[0]);
    // Return both the token object and the actual token (only time we see it unhashed)
    return { refreshToken, token };
  }

  // Find token by hash
  static async findByToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const result = await query(
      `SELECT * FROM refresh_tokens 
       WHERE token_hash = $1 
       AND expires_at > NOW() 
       AND revoked_at IS NULL 
       AND used_at IS NULL`,
      [tokenHash]
    );
    
    return result.rows[0] ? new RefreshToken(result.rows[0]) : null;
  }

  // Find all active tokens for a user
  static async findActiveByUserId(userId) {
    const result = await query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 
       AND expires_at > NOW() 
       AND revoked_at IS NULL 
       AND used_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows.map(row => new RefreshToken(row));
  }

  // Count active tokens for a user
  static async countActiveByUserId(userId) {
    const result = await query(
      `SELECT COUNT(*) FROM refresh_tokens 
       WHERE user_id = $1 
       AND expires_at > NOW() 
       AND revoked_at IS NULL 
       AND used_at IS NULL`,
      [userId]
    );
    
    return parseInt(result.rows[0].count);
  }

  // Mark token as used (for rotation)
  async markAsUsed() {
    const result = await query(
      'UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1 RETURNING *',
      [this.id]
    );

    Object.assign(this, new RefreshToken(result.rows[0]));
    return this;
  }

  // Revoke token
  async revoke() {
    const result = await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 RETURNING *',
      [this.id]
    );

    Object.assign(this, new RefreshToken(result.rows[0]));
    return this;
  }

  // Revoke all tokens for a user
  static async revokeAllForUser(userId) {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1 
       AND revoked_at IS NULL
       RETURNING *`,
      [userId]
    );

    return result.rows.map(row => new RefreshToken(row));
  }

  // Revoke all tokens for a device
  static async revokeAllForDevice(userId, deviceId) {
    const result = await query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW() 
       WHERE user_id = $1 
       AND device_id = $2 
       AND revoked_at IS NULL
       RETURNING *`,
      [userId, deviceId]
    );

    return result.rows.map(row => new RefreshToken(row));
  }

  // Rotate token (mark old as used, create new)
  static async rotate(oldToken, { userAgent, ipAddress }) {
    return transaction(async (client) => {
      // Find and validate the old token
      const tokenHash = crypto.createHash('sha256').update(oldToken).digest('hex');
      
      const oldTokenResult = await client.query(
        `SELECT * FROM refresh_tokens 
         WHERE token_hash = $1 
         AND expires_at > NOW() 
         AND revoked_at IS NULL 
         AND used_at IS NULL
         FOR UPDATE`,
        [tokenHash]
      );

      if (!oldTokenResult.rows[0]) {
        throw new Error('Invalid or expired refresh token');
      }

      const oldRefreshToken = new RefreshToken(oldTokenResult.rows[0]);

      // Mark old token as used
      await client.query(
        'UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1',
        [oldRefreshToken.id]
      );

      // Create new token with same device ID
      const newToken = crypto.randomBytes(64).toString('base64url');
      const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const newTokenResult = await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address, device_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [oldRefreshToken.userId, newTokenHash, expiresAt, userAgent, ipAddress, oldRefreshToken.deviceId]
      );

      const newRefreshToken = new RefreshToken(newTokenResult.rows[0]);
      
      return { refreshToken: newRefreshToken, token: newToken };
    });
  }

  // Clean up old tokens for a user (keep only N most recent per device)
  static async cleanupForUser(userId, keepPerDevice = 5) {
    const result = await query(
      `WITH ranked_tokens AS (
         SELECT id, device_id,
                ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY created_at DESC) as rn
         FROM refresh_tokens
         WHERE user_id = $1
           AND expires_at > NOW()
           AND revoked_at IS NULL
           AND used_at IS NULL
       )
       UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id IN (
         SELECT id FROM ranked_tokens WHERE rn > $2
       )
       RETURNING *`,
      [userId, keepPerDevice]
    );

    return result.rows.length;
  }

  // Check if token is valid
  isValid() {
    return !this.revokedAt && 
           !this.usedAt && 
           new Date(this.expiresAt) > new Date();
  }

  // Get token info for logging
  getInfo() {
    return {
      userId: this.userId,
      deviceId: this.deviceId,
      userAgent: this.userAgent,
      ipAddress: this.ipAddress,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      isValid: this.isValid()
    };
  }

  // Convert to JSON (never expose token hash)
  toJSON() {
    const { tokenHash, ...safeData } = this;
    return safeData;
  }
}

module.exports = RefreshToken;