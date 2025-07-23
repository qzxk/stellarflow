import { Database } from '../config/database.js';

class Category {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.description = data.description;
    this.color = data.color;
    this.parent_id = data.parent_id;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.post_count = data.post_count || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create new category
  static async create(categoryData) {
    const {
      name,
      slug,
      description,
      color,
      parent_id = null
    } = categoryData;

    const sql = `
      INSERT INTO categories (name, slug, description, color, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    try {
      const result = await Database.run(sql, [
        name,
        slug,
        description,
        color,
        parent_id
      ]);

      return await Category.findById(result.lastID);
    } catch (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  // Find category by ID
  static async findById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ?';
    
    try {
      const category = await Database.get(sql, [id]);
      return category ? new Category(category) : null;
    } catch (error) {
      throw new Error(`Failed to find category by ID: ${error.message}`);
    }
  }

  // Find category by slug
  static async findBySlug(slug) {
    const sql = 'SELECT * FROM categories WHERE slug = ?';
    
    try {
      const category = await Database.get(sql, [slug]);
      return category ? new Category(category) : null;
    } catch (error) {
      throw new Error(`Failed to find category by slug: ${error.message}`);
    }
  }

  // Get all categories with hierarchy
  static async findAll(includeInactive = false) {
    let sql = `
      SELECT c.*, COUNT(p.id) as actual_post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
    `;
    
    if (!includeInactive) {
      sql += ' WHERE c.is_active = 1';
    }
    
    sql += `
      GROUP BY c.id
      ORDER BY c.parent_id ASC, c.name ASC
    `;
    
    try {
      const categories = await Database.query(sql);
      
      // Build hierarchical structure
      const categoryMap = new Map();
      const rootCategories = [];
      
      // First pass: create category objects and map
      categories.forEach(cat => {
        const category = new Category(cat);
        category.post_count = cat.actual_post_count;
        category.children = [];
        categoryMap.set(cat.id, category);
        
        if (!cat.parent_id) {
          rootCategories.push(category);
        }
      });
      
      // Second pass: organize hierarchy
      categories.forEach(cat => {
        if (cat.parent_id) {
          const parent = categoryMap.get(cat.parent_id);
          const child = categoryMap.get(cat.id);
          if (parent && child) {
            parent.children.push(child);
          }
        }
      });
      
      return rootCategories;
    } catch (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  // Get flat list of categories
  static async findAllFlat(includeInactive = false) {
    let sql = `
      SELECT c.*, COUNT(p.id) as actual_post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
    `;
    
    if (!includeInactive) {
      sql += ' WHERE c.is_active = 1';
    }
    
    sql += `
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    
    try {
      const categories = await Database.query(sql);
      return categories.map(cat => {
        const category = new Category(cat);
        category.post_count = cat.actual_post_count;
        return category;
      });
    } catch (error) {
      throw new Error(`Failed to get flat categories: ${error.message}`);
    }
  }

  // Update category
  async update(updateData) {
    const allowedFields = [
      'name', 'slug', 'description', 'color', 'parent_id', 'is_active'
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
    
    const sql = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
    
    try {
      await Database.run(sql, values);
      return await Category.findById(this.id);
    } catch (error) {
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  // Delete category (soft delete)
  async delete() {
    const sql = 'UPDATE categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    try {
      await Database.run(sql, [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  // Hard delete category
  async hardDelete() {
    try {
      // First, update posts to remove category reference
      await Database.run('UPDATE posts SET category_id = NULL WHERE category_id = ?', [this.id]);
      
      // Then delete the category
      await Database.run('DELETE FROM categories WHERE id = ?', [this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to hard delete category: ${error.message}`);
    }
  }

  // Get category posts
  async getPosts(limit = 20, offset = 0, status = 'published') {
    const sql = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.category_id = ? AND p.status = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    try {
      return await Database.query(sql, [this.id, status, limit, offset]);
    } catch (error) {
      throw new Error(`Failed to get category posts: ${error.message}`);
    }
  }

  // Get subcategories
  async getChildren() {
    const sql = `
      SELECT c.*, COUNT(p.id) as actual_post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
      WHERE c.parent_id = ? AND c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    
    try {
      const children = await Database.query(sql, [this.id]);
      return children.map(cat => {
        const category = new Category(cat);
        category.post_count = cat.actual_post_count;
        return category;
      });
    } catch (error) {
      throw new Error(`Failed to get category children: ${error.message}`);
    }
  }

  // Get parent category
  async getParent() {
    if (!this.parent_id) return null;
    
    try {
      return await Category.findById(this.parent_id);
    } catch (error) {
      throw new Error(`Failed to get parent category: ${error.message}`);
    }
  }

  // Update post count
  async updatePostCount() {
    const sql = `
      UPDATE categories 
      SET post_count = (
        SELECT COUNT(*) FROM posts 
        WHERE category_id = ? AND status = 'published'
      )
      WHERE id = ?
    `;
    
    try {
      await Database.run(sql, [this.id, this.id]);
      return true;
    } catch (error) {
      throw new Error(`Failed to update post count: ${error.message}`);
    }
  }

  // Get category breadcrumb
  async getBreadcrumb() {
    const breadcrumb = [this];
    let current = this;
    
    while (current.parent_id) {
      const parent = await Category.findById(current.parent_id);
      if (parent) {
        breadcrumb.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    
    return breadcrumb;
  }

  // Generate slug from name
  static generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  // Get popular categories
  static async getPopular(limit = 10) {
    const sql = `
      SELECT c.*, COUNT(p.id) as post_count
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id AND p.status = 'published'
      WHERE c.is_active = 1
      GROUP BY c.id
      HAVING post_count > 0
      ORDER BY post_count DESC, c.name ASC
      LIMIT ?
    `;
    
    try {
      const categories = await Database.query(sql, [limit]);
      return categories.map(cat => new Category(cat));
    } catch (error) {
      throw new Error(`Failed to get popular categories: ${error.message}`);
    }
  }
}

export default Category;