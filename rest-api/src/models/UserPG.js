import BaseModel from './BaseModel.js';
import { Database } from '../config/postgres.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

class User extends BaseModel {
  static get tableName() {
    return 'users';
  }

  static get columns() {
    return [
      'id', 'email', 'password_hash', 'full_name', 'is_active',
      'is_verified', 'role', 'created_at', 'updated_at', 'last_login_at',
      'verification_token', 'verification_expires_at',
      'password_reset_token', 'password_reset_expires_at'
    ];
  }

  // Hide sensitive fields when converting to JSON
  toJSON() {
    const obj = super.toJSON();
    delete obj.password_hash;
    delete obj.verification_token;
    delete obj.password_reset_token;
    delete obj.verification_expires_at;
    delete obj.password_reset_expires_at;
    return obj;
  }

  // Convert to safe object (for API responses)
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      full_name: this.full_name,
      role: this.role,
      is_active: this.is_active,
      is_verified: this.is_verified,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_login_at: this.last_login_at,
    };
  }

  // Validation
  validate() {
    const errors = [];

    // Email validation
    if (!this.email) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!this.isValidEmail(this.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }

    // Password validation (only for new users or password changes)
    if (!this.id && !this.password_hash) {
      errors.push({ field: 'password', message: 'Password is required' });
    }

    // Role validation
    const validRoles = ['user', 'admin', 'moderator'];
    if (this.role && !validRoles.includes(this.role)) {
      errors.push({ field: 'role', message: 'Invalid role' });
    }

    // Full name validation
    if (this.full_name && this.full_name.length > 255) {
      errors.push({ field: 'full_name', message: 'Full name must not exceed 255 characters' });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Email validation helper
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Hash password before saving
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password with hash
  async comparePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  // Generate verification token
  generateVerificationToken() {
    this.verification_token = crypto.randomBytes(32).toString('hex');
    this.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return this.verification_token;
  }

  // Generate password reset token
  generatePasswordResetToken() {
    this.password_reset_token = crypto.randomBytes(32).toString('hex');
    this.password_reset_expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return this.password_reset_token;
  }

  // Find user by email
  static async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  }

  // Create new user with hashed password
  static async create(userData) {
    const data = { ...userData };
    
    // Normalize email
    if (data.email) {
      data.email = data.email.toLowerCase();
    }

    // Hash password if provided
    if (data.password) {
      data.password_hash = await this.hashPassword(data.password);
      delete data.password;
    }

    // Set defaults
    data.role = data.role || 'user';
    data.is_active = data.is_active !== undefined ? data.is_active : true;
    data.is_verified = data.is_verified !== undefined ? data.is_verified : false;

    return await super.create(data);
  }

  // Update user
  async update(updateData) {
    const data = { ...updateData };

    // Hash password if changing
    if (data.password) {
      data.password_hash = await User.hashPassword(data.password);
      delete data.password;
    }

    // Normalize email if changing
    if (data.email) {
      data.email = data.email.toLowerCase();
    }

    // Update the user
    await User.update({ id: this.id }, data);
    
    // Reload the instance
    const updated = await User.findById(this.id);
    Object.assign(this, updated);
    
    return this;
  }

  // Verify user email
  async verify(token) {
    if (this.verification_token !== token) {
      throw new Error('Invalid verification token');
    }

    if (new Date() > new Date(this.verification_expires_at)) {
      throw new Error('Verification token has expired');
    }

    this.is_verified = true;
    this.verification_token = null;
    this.verification_expires_at = null;

    await this.save();
    return true;
  }

  // Reset password
  async resetPassword(token, newPassword) {
    if (this.password_reset_token !== token) {
      throw new Error('Invalid reset token');
    }

    if (new Date() > new Date(this.password_reset_expires_at)) {
      throw new Error('Reset token has expired');
    }

    this.password_hash = await User.hashPassword(newPassword);
    this.password_reset_token = null;
    this.password_reset_expires_at = null;

    await this.save();
    return true;
  }

  // Update last login
  async updateLastLogin() {
    this.last_login_at = new Date();
    await User.update({ id: this.id }, { last_login_at: this.last_login_at });
  }

  // Find active users
  static async findActive(options = {}) {
    return await this.findAll({
      ...options,
      where: {
        ...options.where,
        is_active: true,
        is_verified: true,
      },
    });
  }

  // Find users by role
  static async findByRole(role, options = {}) {
    return await this.findAll({
      ...options,
      where: {
        ...options.where,
        role,
      },
    });
  }

  // Get user statistics
  static async getStatistics() {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'moderator' THEN 1 END) as moderator_count,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
        COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_last_week,
        COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as active_last_month,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_last_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_last_month
      FROM users
    `;

    return await Database.get(query);
  }

  // Check if user has permission (basic role-based check)
  hasPermission(permission) {
    const rolePermissions = {
      admin: ['all'],
      moderator: ['read', 'write', 'moderate'],
      user: ['read', 'write:own'],
    };

    const userPermissions = rolePermissions[this.role] || [];
    
    // Admin has all permissions
    if (userPermissions.includes('all')) {
      return true;
    }

    return userPermissions.includes(permission);
  }

  // Check if user can modify a resource
  canModify(resource) {
    if (this.role === 'admin') {
      return true;
    }

    // Check if user owns the resource
    if (resource.created_by === this.id || resource.user_id === this.id) {
      return true;
    }

    // Moderators can modify most resources
    if (this.role === 'moderator') {
      return true;
    }

    return false;
  }

  // Search users
  static async search(searchTerm, options = {}) {
    const { page = 1, limit = 10, role, isActive = true } = options;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Search conditions
    conditions.push(`(email ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex})`);
    params.push(`%${searchTerm}%`);
    paramIndex++;

    if (isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(isActive);
    }

    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`;
    const { count } = await Database.get(countQuery, params);

    // Search query
    const query = `
      SELECT * FROM users
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN email ILIKE $1 THEN 1
          WHEN full_name ILIKE $1 THEN 2
          ELSE 3
        END,
        created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const users = await Database.all(query, params);

    return {
      users: users.map(u => new User(u)),
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
      searchTerm,
    };
  }

  // Bulk update user status
  static async bulkUpdateStatus(userIds, updates) {
    const { is_active, is_verified, role } = updates;
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (is_verified !== undefined) {
      setClause.push(`is_verified = $${paramIndex++}`);
      params.push(is_verified);
    }

    if (role !== undefined) {
      setClause.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (setClause.length === 0) {
      return { rowCount: 0 };
    }

    setClause.push('updated_at = CURRENT_TIMESTAMP');

    const placeholders = userIds.map((_, index) => `$${paramIndex + index}`).join(', ');
    params.push(...userIds);

    const query = `
      UPDATE users 
      SET ${setClause.join(', ')}
      WHERE id IN (${placeholders})
    `;

    return await Database.run(query, params);
  }
}

export default User;