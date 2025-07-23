const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, transaction } = require('../connection');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.fullName = data.full_name;
    this.isActive = data.is_active;
    this.isVerified = data.is_verified;
    this.role = data.role;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.lastLoginAt = data.last_login_at;
    this.verificationToken = data.verification_token;
    this.verificationExpiresAt = data.verification_expires_at;
    this.passwordResetToken = data.password_reset_token;
    this.passwordResetExpiresAt = data.password_reset_expires_at;
  }

  // Create a new user
  static async create({ email, password, fullName, role = 'user' }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, verification_token, verification_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, passwordHash, fullName, role, verificationToken, verificationExpiresAt]
    );

    return new User(result.rows[0]);
  }

  // Find user by ID
  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Find user by email
  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Find user by verification token
  static async findByVerificationToken(token) {
    const result = await query(
      `SELECT * FROM users 
       WHERE verification_token = $1 
       AND verification_expires_at > NOW()`,
      [token]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // Find user by password reset token
  static async findByPasswordResetToken(token) {
    const result = await query(
      `SELECT * FROM users 
       WHERE password_reset_token = $1 
       AND password_reset_expires_at > NOW()`,
      [token]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  // List users with pagination
  static async list({ limit = 20, offset = 0, isActive = null, role = null }) {
    let queryText = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (isActive !== null) {
      params.push(isActive);
      queryText += ` AND is_active = $${params.length}`;
    }

    if (role) {
      params.push(role);
      queryText += ` AND role = $${params.length}`;
    }

    queryText += ' ORDER BY created_at DESC';
    
    params.push(limit, offset);
    queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(queryText, params);
    return result.rows.map(row => new User(row));
  }

  // Count users
  static async count({ isActive = null, role = null }) {
    let queryText = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const params = [];

    if (isActive !== null) {
      params.push(isActive);
      queryText += ` AND is_active = $${params.length}`;
    }

    if (role) {
      params.push(role);
      queryText += ` AND role = $${params.length}`;
    }

    const result = await query(queryText, params);
    return parseInt(result.rows[0].count);
  }

  // Update user
  async update(updates) {
    const allowedUpdates = ['email', 'full_name', 'is_active', 'is_verified', 'role'];
    const updateFields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        params.push(value);
        updateFields.push(`${key} = $${params.length}`);
      }
    }

    if (updateFields.length === 0) {
      return this;
    }

    params.push(this.id);
    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Verify email
  async verify() {
    const result = await query(
      `UPDATE users 
       SET is_verified = true, verification_token = NULL, verification_expires_at = NULL 
       WHERE id = $1 
       RETURNING *`,
      [this.id]
    );

    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Set password reset token
  async setPasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const result = await query(
      `UPDATE users 
       SET password_reset_token = $1, password_reset_expires_at = $2 
       WHERE id = $3 
       RETURNING *`,
      [resetToken, expiresAt, this.id]
    );

    Object.assign(this, new User(result.rows[0]));
    return resetToken;
  }

  // Reset password
  async resetPassword(newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await query(
      `UPDATE users 
       SET password_hash = $1, password_reset_token = NULL, password_reset_expires_at = NULL 
       WHERE id = $2 
       RETURNING *`,
      [passwordHash, this.id]
    );

    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Update last login
  async updateLastLogin() {
    const result = await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1 RETURNING *',
      [this.id]
    );

    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Check password
  async checkPassword(password) {
    return bcrypt.compare(password, this.passwordHash);
  }

  // Delete user (soft delete by deactivating)
  async delete() {
    const result = await query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING *',
      [this.id]
    );

    Object.assign(this, new User(result.rows[0]));
    return this;
  }

  // Convert to JSON (remove sensitive fields)
  toJSON() {
    const { passwordHash, verificationToken, passwordResetToken, ...user } = this;
    return user;
  }
}

module.exports = User;