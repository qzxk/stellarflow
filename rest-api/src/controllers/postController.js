import { Database } from '../config/database.js';
import { PostService } from '../services/PostService.js';

class PostController {
  async getAll(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        sort = 'created_at', 
        order = 'DESC', 
        search, 
        category_id, 
        author_id, 
        status = 'published',
        is_featured 
      } = req.query;
      
      const offset = (page - 1) * limit;
      let query = `
        SELECT 
          p.*,
          u.username as author_username,
          u.avatar_url as author_avatar,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
      `;
      const params = [];
      
      // Apply filters
      if (search) {
        query += ' AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }
      
      if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(category_id);
      }
      
      if (author_id) {
        query += ' AND p.author_id = ?';
        params.push(author_id);
      }
      
      if (status) {
        query += ' AND p.status = ?';
        params.push(status);
      }
      
      if (is_featured !== undefined) {
        query += ' AND p.is_featured = ?';
        params.push(is_featured === 'true' ? 1 : 0);
      }
      
      // Get total count
      const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
      const { total } = await Database.get(countQuery, params);
      
      // Apply sorting and pagination
      const validSortFields = ['title', 'created_at', 'updated_at', 'published_at', 'view_count', 'like_count', 'comment_count'];
      const sortField = validSortFields.includes(sort) ? `p.${sort}` : 'p.created_at';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);
      
      const posts = await Database.query(query, params);
      
      // Parse tags
      posts.forEach(post => {
        if (post.tags) {
          post.tags = JSON.parse(post.tags);
        }
      });
      
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

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      
      const post = await Database.get(`
        SELECT 
          p.*,
          u.username as author_username,
          u.avatar_url as author_avatar,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [id]);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Check if post is published or user is author/admin
      if (post.status !== 'published' && 
          (!req.user || (req.user.userId !== post.author_id && req.user.role !== 'admin'))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Parse tags
      if (post.tags) {
        post.tags = JSON.parse(post.tags);
      }
      
      // Increment view count
      await Database.run(
        'UPDATE posts SET view_count = view_count + 1 WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      
      const post = await Database.get(`
        SELECT 
          p.*,
          u.username as author_username,
          u.avatar_url as author_avatar,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = ? AND p.status = 'published'
      `, [slug]);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Parse tags
      if (post.tags) {
        post.tags = JSON.parse(post.tags);
      }
      
      // Increment view count
      await Database.run(
        'UPDATE posts SET view_count = view_count + 1 WHERE id = ?',
        [post.id]
      );
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const {
        title,
        content,
        excerpt,
        category_id,
        status = 'draft',
        featured_image,
        featured_image_alt,
        tags,
        meta_title,
        meta_description,
        is_featured = false
      } = req.body;
      
      const author_id = req.user.userId;
      
      // Generate slug
      const baseSlug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check for duplicate slug
      let slug = baseSlug;
      let counter = 1;
      while (await Database.get('SELECT id FROM posts WHERE slug = ?', [slug])) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      // Calculate reading time (words per minute)
      const wordCount = content.split(/\s+/).length;
      const reading_time = Math.ceil(wordCount / 200);
      
      // Set published_at if status is published
      const published_at = status === 'published' ? new Date().toISOString() : null;
      
      const result = await Database.run(
        `INSERT INTO posts (
          title, slug, content, excerpt, author_id, category_id, status,
          featured_image, featured_image_alt, tags, meta_title, meta_description,
          reading_time, is_featured, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title, slug, content, excerpt || null, author_id, category_id || null, status,
          featured_image || null, featured_image_alt || null, 
          tags ? JSON.stringify(tags) : null,
          meta_title || title, meta_description || excerpt || null,
          reading_time, is_featured ? 1 : 0, published_at
        ]
      );
      
      const post = await PostService.findById(result.lastID);
      
      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        excerpt,
        category_id,
        status,
        featured_image,
        featured_image_alt,
        tags,
        meta_title,
        meta_description,
        is_featured
      } = req.body;
      
      // Check if post exists and user has permission
      const post = await PostService.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      if (req.user.userId !== post.author_id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Update slug if title changed
      let slug = post.slug;
      if (title && title !== post.title) {
        const baseSlug = title.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        slug = baseSlug;
        let counter = 1;
        while (await Database.get('SELECT id FROM posts WHERE slug = ? AND id != ?', [slug, id])) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }
      
      // Calculate reading time if content changed
      let reading_time = post.reading_time;
      if (content) {
        const wordCount = content.split(/\s+/).length;
        reading_time = Math.ceil(wordCount / 200);
      }
      
      // Set published_at if changing to published
      let published_at = post.published_at;
      if (status === 'published' && post.status !== 'published') {
        published_at = new Date().toISOString();
      }
      
      await Database.run(
        `UPDATE posts SET 
          title = COALESCE(?, title),
          slug = ?,
          content = COALESCE(?, content),
          excerpt = COALESCE(?, excerpt),
          category_id = COALESCE(?, category_id),
          status = COALESCE(?, status),
          featured_image = COALESCE(?, featured_image),
          featured_image_alt = COALESCE(?, featured_image_alt),
          tags = COALESCE(?, tags),
          meta_title = COALESCE(?, meta_title),
          meta_description = COALESCE(?, meta_description),
          reading_time = ?,
          is_featured = COALESCE(?, is_featured),
          published_at = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          title, slug, content, excerpt, category_id, status,
          featured_image, featured_image_alt,
          tags ? JSON.stringify(tags) : post.tags,
          meta_title, meta_description,
          reading_time,
          is_featured !== undefined ? (is_featured ? 1 : 0) : post.is_featured,
          published_at,
          new Date().toISOString(),
          id
        ]
      );
      
      const updatedPost = await PostService.findById(id);
      
      res.json({
        success: true,
        message: 'Post updated successfully',
        data: updatedPost
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if post exists and user has permission
      const post = await PostService.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      if (req.user.userId !== post.author_id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Delete post (cascades to comments and likes)
      await Database.run('DELETE FROM posts WHERE id = ?', [id]);
      
      res.json({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleLike(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      
      // Check if post exists
      const post = await PostService.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Check if already liked
      const existingLike = await Database.get(
        'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
        [id, userId]
      );
      
      if (existingLike) {
        // Unlike
        await Database.run(
          'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
          [id, userId]
        );
        
        await Database.run(
          'UPDATE posts SET like_count = like_count - 1 WHERE id = ?',
          [id]
        );
        
        res.json({
          success: true,
          message: 'Post unliked',
          data: { liked: false }
        });
      } else {
        // Like
        await Database.run(
          'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
          [id, userId]
        );
        
        await Database.run(
          'UPDATE posts SET like_count = like_count + 1 WHERE id = ?',
          [id]
        );
        
        res.json({
          success: true,
          message: 'Post liked',
          data: { liked: true }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  async getPopular(req, res, next) {
    try {
      const { limit = 10, days = 7 } = req.query;
      
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      const posts = await Database.query(`
        SELECT 
          p.*,
          u.username as author_username,
          u.avatar_url as author_avatar,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published' AND p.published_at >= ?
        ORDER BY (p.view_count + p.like_count * 2 + p.comment_count * 3) DESC
        LIMIT ?
      `, [date.toISOString(), parseInt(limit)]);
      
      // Parse tags
      posts.forEach(post => {
        if (post.tags) {
          post.tags = JSON.parse(post.tags);
        }
      });
      
      res.json({
        success: true,
        data: posts
      });
    } catch (error) {
      next(error);
    }
  }

  async getRelated(req, res, next) {
    try {
      const { id } = req.params;
      const { limit = 5 } = req.query;
      
      // Get current post
      const post = await PostService.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found'
        });
      }
      
      // Find related posts by category and tags
      const relatedPosts = await Database.query(`
        SELECT DISTINCT
          p.*,
          u.username as author_username,
          u.avatar_url as author_avatar,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id != ? 
          AND p.status = 'published'
          AND (p.category_id = ? OR p.tags LIKE ?)
        ORDER BY 
          CASE WHEN p.category_id = ? THEN 1 ELSE 0 END DESC,
          p.view_count DESC
        LIMIT ?
      `, [
        id, 
        post.category_id, 
        post.tags ? `%${JSON.parse(post.tags)[0]}%` : '%',
        post.category_id,
        parseInt(limit)
      ]);
      
      // Parse tags
      relatedPosts.forEach(post => {
        if (post.tags) {
          post.tags = JSON.parse(post.tags);
        }
      });
      
      res.json({
        success: true,
        data: relatedPosts
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PostController();