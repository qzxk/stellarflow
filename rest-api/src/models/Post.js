import { Database } from '../config/database.js';

class Post {
  constructor(data = {}) {
    this.id = data.id;
    this.title = data.title;
    this.content = data.content;
    this.excerpt = data.excerpt;
    this.author_id = data.author_id;
    this.status = data.status || 'published';
    this.featured_image = data.featured_image;
    this.tags = data.tags;
    this.view_count = data.view_count || 0;
    this.like_count = data.like_count || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create new post
  static async create(postData) {
    const {
      title,
      content,
      excerpt,
      author_id,
      status = 'published',
      featured_image,
      tags
    } = postData;

    // Convert tags array to JSON string
    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags;

    const sql = `
      INSERT INTO posts (title, content, excerpt, author_id, status, featured_image, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const result = await Database.run(sql, [
        title,
        content,
        excerpt,
        author_id,
        status,
        featured_image,
        tagsJson
      ]);

      return await Post.findById(result.lastID);
    } catch (error) {
      throw new Error(`Failed to create post: ${error.message}`);
    }
  }

  // Find post by ID
  static async findById(id) {
    const sql = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `;
    
    try {
      const post = await Database.get(sql, [id]);
      if (!post) return null;

      // Parse tags JSON
      if (post.tags) {
        try {
          post.tags = JSON.parse(post.tags);
        } catch (e) {
          post.tags = post.tags.split(',').map(tag => tag.trim());
        }
      }

      return new Post({
        ...post,
        author: {
          id: post.author_id,
          username: post.username,
          first_name: post.first_name,
          last_name: post.last_name,
          avatar_url: post.avatar_url
        }
      });
    } catch (error) {
      throw new Error(`Failed to find post by ID: ${error.message}`);
    }
  }

  // Find all posts with filters
  static async findAll(options = {}) {
    const {
      limit = 20,
      offset = 0,
      status = 'published',
      author_id,
      tags,
      search,
      sort = 'created_at',
      order = 'DESC'
    } = options;

    let sql = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = ?
    `;
    
    const params = [status];

    // Add filters
    if (author_id) {
      sql += ' AND p.author_id = ?';
      params.push(author_id);
    }

    if (tags) {
      sql += ' AND p.tags LIKE ?';
      params.push(`%${tags}%`);
    }

    if (search) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Add sorting
    const allowedSorts = ['created_at', 'updated_at', 'title', 'view_count', 'like_count'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    sql += ` ORDER BY p.${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    try {
      const posts = await Database.query(sql, params);
      
      return posts.map(post => {
        // Parse tags JSON
        if (post.tags) {
          try {
            post.tags = JSON.parse(post.tags);
          } catch (e) {
            post.tags = post.tags.split(',').map(tag => tag.trim());
          }
        }

        return new Post({
          ...post,
          author: {
            id: post.author_id,
            username: post.username,
            first_name: post.first_name,
            last_name: post.last_name,
            avatar_url: post.avatar_url
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to get posts: ${error.message}`);
    }
  }

  // Get total post count
  static async getTotalCount(status = 'published', author_id = null) {
    let sql = 'SELECT COUNT(*) as count FROM posts WHERE status = ?';
    const params = [status];
    
    if (author_id) {
      sql += ' AND author_id = ?';
      params.push(author_id);
    }
    
    try {
      const result = await Database.get(sql, params);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get post count: ${error.message}`);
    }
  }

  // Search posts
  static async search(query, limit = 20, offset = 0) {
    const sql = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published' AND (
        p.title LIKE ? OR 
        p.content LIKE ? OR 
        p.excerpt LIKE ? OR
        p.tags LIKE ?
      )
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const searchTerm = `%${query}%`;
    
    try {
      const posts = await Database.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm, limit, offset]);
      
      return posts.map(post => {
        // Parse tags JSON
        if (post.tags) {
          try {
            post.tags = JSON.parse(post.tags);
          } catch (e) {
            post.tags = post.tags.split(',').map(tag => tag.trim());
          }
        }

        return new Post({
          ...post,
          author: {
            id: post.author_id,
            username: post.username,
            first_name: post.first_name,
            last_name: post.last_name,
            avatar_url: post.avatar_url
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to search posts: ${error.message}`);
    }
  }

  // Update post
  async update(updateData) {
    const allowedFields = [
      'title', 'content', 'excerpt', 'status', 
      'featured_image', 'tags'
    ];
    
    const updates = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates.push(`${key} = ?`);
        
        // Convert tags array to JSON string
        if (key === 'tags' && Array.isArray(updateData[key])) {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
      }
    });
    
    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);
    
    const sql = `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`;
    
    try {
      await Database.run(sql, values);
      return await Post.findById(this.id);
    } catch (error) {
      throw new Error(`Failed to update post: ${error.message}`);
    }
  }

  // Delete post
  async delete() {
    const sql = 'DELETE FROM posts WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete post: ${error.message}`);
    }
  }

  // Increment view count
  async incrementViewCount() {
    const sql = 'UPDATE posts SET view_count = view_count + 1 WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      this.view_count += 1;
      return true;
    } catch (error) {
      throw new Error(`Failed to increment view count: ${error.message}`);
    }
  }

  // Increment like count
  async incrementLikeCount() {
    const sql = 'UPDATE posts SET like_count = like_count + 1 WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      this.like_count += 1;
      return true;
    } catch (error) {
      throw new Error(`Failed to increment like count: ${error.message}`);
    }
  }

  // Get comments for this post
  async getComments(limit = 20, offset = 0) {
    const sql = `
      SELECT c.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ? AND c.is_approved = 1
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `;
    
    try {
      const comments = await Database.query(sql, [this.id, limit, offset]);
      
      return comments.map(comment => ({
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

  // Get comment count for this post
  async getCommentCount() {
    const sql = 'SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND is_approved = 1';
    
    try {
      const result = await Database.get(sql, [this.id]);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to get comment count: ${error.message}`);
    }
  }

  // Convert to JSON (parsing tags if needed)
  toJSON() {
    const obj = { ...this };
    
    // Ensure tags is an array
    if (typeof obj.tags === 'string') {
      try {
        obj.tags = JSON.parse(obj.tags);
      } catch (e) {
        obj.tags = obj.tags.split(',').map(tag => tag.trim());
      }
    }
    
    return obj;
  }
}

export default Post;