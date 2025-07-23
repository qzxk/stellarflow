import { Database } from '../config/database.js';
import { UserService } from '../services/UserService.js';
import bcrypt from 'bcrypt';

class UserController {
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20, sort = 'created_at', order = 'DESC', search, role, is_active } = req.query;
      
      const offset = (page - 1) * limit;
      let query = 'SELECT id, username, email, first_name, last_name, avatar_url, bio, role, is_active, email_verified, last_login, login_count, created_at, updated_at FROM users WHERE 1=1';
      const params = [];
      
      // Apply filters
      if (search) {
        query += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      
      if (is_active !== undefined) {
        query += ' AND is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
      }
      
      // Get total count
      const countQuery = query.replace('SELECT id, username, email, first_name, last_name, avatar_url, bio, role, is_active, email_verified, last_login, login_count, created_at, updated_at', 'SELECT COUNT(*) as total');
      const { total } = await Database.get(countQuery, params);
      
      // Apply sorting and pagination
      const validSortFields = ['username', 'email', 'created_at', 'updated_at', 'last_login', 'login_count'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);
      
      const users = await Database.query(query, params);
      
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await UserService.findById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      delete user.password_hash;
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const user = await UserService.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      delete user.password_hash;
      
      // Get additional profile data
      const stats = await Database.get(`
        SELECT 
          (SELECT COUNT(*) FROM posts WHERE author_id = ?) as post_count,
          (SELECT COUNT(*) FROM comments WHERE author_id = ?) as comment_count,
          (SELECT COUNT(*) FROM post_likes WHERE user_id = ?) as like_count
      `, [userId, userId, userId]);
      
      res.json({
        success: true,
        data: {
          ...user,
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const userId = req.user.userId;
      const { first_name, last_name, bio, avatar_url } = req.body;
      
      // Update user profile
      await Database.run(
        `UPDATE users SET 
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          updated_at = ?
        WHERE id = ?`,
        [first_name, last_name, bio, avatar_url, new Date().toISOString(), userId]
      );
      
      const updatedUser = await UserService.findById(userId);
      delete updatedUser.password_hash;
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { username, email, password, first_name, last_name, role = 'user' } = req.body;
      
      // Check if user already exists
      const existingUser = await Database.get(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
      );
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email or username already exists'
        });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || 10));
      
      // Create user
      const result = await Database.run(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, email, passwordHash, first_name || null, last_name || null, role]
      );
      
      const user = await UserService.findById(result.lastID);
      delete user.password_hash;
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { username, email, first_name, last_name, role, is_active } = req.body;
      
      // Check if user exists
      const user = await UserService.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Check for username/email conflicts
      if (username || email) {
        const conflictQuery = 'SELECT id FROM users WHERE (email = ? OR username = ?) AND id != ?';
        const conflict = await Database.get(conflictQuery, [email || user.email, username || user.username, id]);
        
        if (conflict) {
          return res.status(409).json({
            success: false,
            error: 'Username or email already in use'
          });
        }
      }
      
      // Update user
      await Database.run(
        `UPDATE users SET 
          username = COALESCE(?, username),
          email = COALESCE(?, email),
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          role = COALESCE(?, role),
          is_active = COALESCE(?, is_active),
          updated_at = ?
        WHERE id = ?`,
        [username, email, first_name, last_name, role, is_active, new Date().toISOString(), id]
      );
      
      const updatedUser = await UserService.findById(id);
      delete updatedUser.password_hash;
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if user exists
      const user = await UserService.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Prevent deleting own account (if admin)
      if (req.user.userId === parseInt(id)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete your own account'
        });
      }
      
      // Soft delete by deactivating
      await Database.run(
        'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), id]
      );
      
      // Revoke all tokens
      await Database.run(
        'UPDATE refresh_tokens SET is_revoked = 1, revoked_at = ? WHERE user_id = ?',
        [new Date().toISOString(), id]
      );
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserPosts(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10 } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Get user
      const user = await UserService.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Get posts
      const posts = await Database.query(
        `SELECT p.*, u.username, u.avatar_url, c.name as category_name
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.author_id = ? AND p.status = 'published'
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`,
        [id, parseInt(limit), offset]
      );
      
      const { total } = await Database.get(
        'SELECT COUNT(*) as total FROM posts WHERE author_id = ? AND status = ?',
        [id, 'published']
      );
      
      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserStats(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if user exists
      const user = await UserService.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Get comprehensive stats
      const stats = await Database.get(`
        SELECT 
          (SELECT COUNT(*) FROM posts WHERE author_id = ?) as total_posts,
          (SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'published') as published_posts,
          (SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'draft') as draft_posts,
          (SELECT COUNT(*) FROM comments WHERE author_id = ?) as total_comments,
          (SELECT COUNT(*) FROM post_likes pl JOIN posts p ON pl.post_id = p.id WHERE p.author_id = ?) as received_likes,
          (SELECT COUNT(*) FROM post_likes WHERE user_id = ?) as given_likes,
          (SELECT SUM(view_count) FROM posts WHERE author_id = ?) as total_views
      `, [id, id, id, id, id, id, id]);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();