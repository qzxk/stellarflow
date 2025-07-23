import { Database } from '../config/database.js';

class Comment {
  constructor(data = {}) {
    this.id = data.id;
    this.content = data.content;
    this.post_id = data.post_id;
    this.author_id = data.author_id;
    this.parent_id = data.parent_id;
    this.is_approved = data.is_approved !== undefined ? data.is_approved : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create new comment
  static async create(commentData) {
    const {
      content,
      post_id,
      author_id,
      parent_id = null,
      is_approved = true
    } = commentData;

    const sql = `
      INSERT INTO comments (content, post_id, author_id, parent_id, is_approved)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const result = await Database.run(sql, [
        content,
        post_id,
        author_id,
        parent_id,
        is_approved
      ]);

      return await Comment.findById(result.lastID);
    } catch (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  // Find comment by ID
  static async findById(id) {
    const sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url,
             p.title as post_title
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = ?
    `;
    
    try {
      const comment = await Database.get(sql, [id]);
      if (!comment) return null;

      return new Comment({
        ...comment,
        author: {
          id: comment.author_id,
          username: comment.username,
          first_name: comment.first_name,
          last_name: comment.last_name,
          avatar_url: comment.avatar_url
        },
        post: {
          id: comment.post_id,
          title: comment.post_title
        }
      });
    } catch (error) {
      throw new Error(`Failed to find comment by ID: ${error.message}`);
    }
  }

  // Find all comments for a post
  static async findByPostId(postId, limit = 20, offset = 0, includeReplies = true) {
    let sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ? AND c.is_approved = 1
    `;
    
    const params = [postId];

    if (!includeReplies) {
      sql += ' AND c.parent_id IS NULL';
    }

    sql += ' ORDER BY c.created_at ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    try {
      const comments = await Database.query(sql, params);
      
      return comments.map(comment => new Comment({
        ...comment,
        author: {
          id: comment.author_id,
          username: comment.username,
          first_name: comment.first_name,
          last_name: comment.last_name,
          avatar_url: comment.avatar_url
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get comments: ${error.message}`);
    }
  }

  // Find replies to a comment
  static async findReplies(parentId, limit = 10, offset = 0) {
    const sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.parent_id = ? AND c.is_approved = 1
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `;
    
    try {
      const replies = await Database.query(sql, [parentId, limit, offset]);
      
      return replies.map(reply => new Comment({
        ...reply,
        author: {
          id: reply.author_id,
          username: reply.username,
          first_name: reply.first_name,
          last_name: reply.last_name,
          avatar_url: reply.avatar_url
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get replies: ${error.message}`);
    }
  }

  // Find comments by user
  static async findByUserId(userId, limit = 20, offset = 0) {
    const sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url,
             p.title as post_title, p.id as post_id
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN posts p ON c.post_id = p.id
      WHERE c.author_id = ? AND c.is_approved = 1
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    try {
      const comments = await Database.query(sql, [userId, limit, offset]);
      
      return comments.map(comment => new Comment({
        ...comment,
        author: {
          id: comment.author_id,
          username: comment.username,
          first_name: comment.first_name,
          last_name: comment.last_name,
          avatar_url: comment.avatar_url
        },
        post: {
          id: comment.post_id,
          title: comment.post_title
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get user comments: ${error.message}`);
    }
  }

  // Update comment
  async update(updateData) {
    const allowedFields = ['content', 'is_approved'];
    
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
    
    const sql = `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`;
    
    try {
      await Database.run(sql, values);
      return await Comment.findById(this.id);
    } catch (error) {
      throw new Error(`Failed to update comment: ${error.message}`);
    }
  }

  // Delete comment
  async delete() {
    const sql = 'DELETE FROM comments WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  }

  // Approve comment
  async approve() {
    try {
      return await this.update({ is_approved: true });
    } catch (error) {
      throw new Error(`Failed to approve comment: ${error.message}`);
    }
  }

  // Reject comment
  async reject() {
    try {
      return await this.update({ is_approved: false });
    } catch (error) {
      throw new Error(`Failed to reject comment: ${error.message}`);
    }
  }

  // Get reply count
  async getReplyCount() {
    const sql = 'SELECT COUNT(*) as count FROM comments WHERE parent_id = ? AND is_approved = 1';
    
    try {
      const result = await Database.get(sql, [this.id]);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get reply count: ${error.message}`);
    }
  }

  // Get total comment count for a post
  static async getCountByPostId(postId) {
    const sql = 'SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND is_approved = 1';
    
    try {
      const result = await Database.get(sql, [postId]);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get comment count: ${error.message}`);
    }
  }

  // Get recent comments (admin/moderation)
  static async getRecent(limit = 20, offset = 0, includeUnapproved = false) {
    let sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url,
             p.title as post_title, p.id as post_id
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN posts p ON c.post_id = p.id
    `;

    if (!includeUnapproved) {
      sql += ' WHERE c.is_approved = 1';
    }

    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    
    try {
      const comments = await Database.query(sql, [limit, offset]);
      
      return comments.map(comment => new Comment({
        ...comment,
        author: {
          id: comment.author_id,
          username: comment.username,
          first_name: comment.first_name,
          last_name: comment.last_name,
          avatar_url: comment.avatar_url
        },
        post: {
          id: comment.post_id,
          title: comment.post_title
        }
      }));
    } catch (error) {
      throw new Error(`Failed to get recent comments: ${error.message}`);
    }
  }

  // Search comments
  static async search(query, limit = 20, offset = 0) {
    const sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url,
             p.title as post_title, p.id as post_id
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN posts p ON c.post_id = p.id
      WHERE c.is_approved = 1 AND c.content LIKE ?
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const searchTerm = `%${query}%`;
    
    try {
      const comments = await Database.query(sql, [searchTerm, limit, offset]);
      
      return comments.map(comment => new Comment({
        ...comment,
        author: {
          id: comment.author_id,
          username: comment.username,
          first_name: comment.first_name,
          last_name: comment.last_name,
          avatar_url: comment.avatar_url
        },
        post: {
          id: comment.post_id,
          title: comment.post_title
        }
      }));
    } catch (error) {
      throw new Error(`Failed to search comments: ${error.message}`);
    }
  }

  // Convert to JSON
  toJSON() {
    return { ...this };
  }
}

export default Comment;