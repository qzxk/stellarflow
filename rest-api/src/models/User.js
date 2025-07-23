import { Database } from '../config/database.js';
import bcrypt from 'bcryptjs';

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.password_hash = data.password_hash;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.avatar_url = data.avatar_url;
    this.bio = data.bio;
    this.role = data.role || 'user';
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create new user
  static async create(userData) {
    const {
      username,
      email,
      password,
      first_name,
      last_name,
      avatar_url,
      bio,
      role = 'user'
    } = userData;

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, avatar_url, bio, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await Database.run(sql, [
        username,
        email,
        password_hash,
        first_name,
        last_name,
        avatar_url,
        bio,
        role
      ]);

      return await User.findById(result.lastID);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    
    try {
      const user = await Database.get(sql, [id]);
      return user ? new User(user) : null;
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    
    try {
      const user = await Database.get(sql, [email]);
      return user ? new User(user) : null;
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  // Find user by username
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    
    try {
      const user = await Database.get(sql, [username]);
      return user ? new User(user) : null;
    } catch (error) {
      throw new Error(`Failed to find user by username: ${error.message}`);
    }
  }

  // Get all users (with pagination)
  static async findAll(limit = 50, offset = 0) {
    const sql = `
      SELECT id, username, email, first_name, last_name, avatar_url, bio, role, is_active, created_at, updated_at
      FROM users 
      WHERE is_active = 1
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    try {
      const users = await Database.query(sql, [limit, offset]);
      return users.map(user => new User(user));
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  // Update user
  async update(updateData) {
    const allowedFields = [
      'username', 'email', 'first_name', 'last_name', 
      'avatar_url', 'bio', 'role', 'is_active'
    ];
    
    const updates = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);
    
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    try {
      await Database.run(sql, values);
      return await User.findById(this.id);
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  // Delete user (soft delete)
  async delete() {
    const sql = 'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // Hard delete user
  async hardDelete() {
    const sql = 'DELETE FROM users WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to hard delete user: ${error.message}`);
    }
  }

  // Verify password
  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.password_hash);
    } catch (error) {
      throw new Error(`Failed to verify password: ${error.message}`);
    }
  }

  // Update password
  async updatePassword(newPassword) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);
    
    const sql = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    try {
      await Database.run(sql, [password_hash, this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  // Get total user count
  static async getTotalCount() {
    const sql = 'SELECT COUNT(*) as count FROM users WHERE is_active = 1';
    
    try {
      const result = await Database.get(sql);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get user count: ${error.message}`);
    }
  }

  // Search users
  static async search(query, limit = 20, offset = 0) {
    const sql = `
      SELECT id, username, email, first_name, last_name, avatar_url, bio, created_at
      FROM users 
      WHERE is_active = 1 AND (
        username LIKE ? OR 
        first_name LIKE ? OR 
        last_name LIKE ? OR 
        email LIKE ?
      )
      ORDER BY username ASC
      LIMIT ? OFFSET ?
    `;
    
    const searchTerm = `%${query}%`;
    
    try {
      const users = await Database.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm, limit, offset]);
      return users.map(user => new User(user));
    } catch (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }

  // Get user posts
  async getPosts(limit = 10, offset = 0) {
    const sql = `
      SELECT * FROM posts 
      WHERE author_id = ? AND status = 'published'
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    try {
      return await Database.query(sql, [this.id, limit, offset]);
    } catch (error) {
      throw new Error(`Failed to get user posts: ${error.message}`);
    }
  }

  // Convert to safe object (without password)
  toSafeObject() {
    const {
      password_hash,
      ...safeUser
    } = this;
    
    return safeUser;
  }

  // Convert to JSON (without password)
  toJSON() {
    return this.toSafeObject();
  }
}

export default User;