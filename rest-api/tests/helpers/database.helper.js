import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseHelper {
  static db = null;

  static async initialize() {
    if (this.db) return this.db;

    this.db = await open({
      filename: ':memory:',
      driver: sqlite3.Database
    });

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await this.db.exec(schema);

    return this.db;
  }

  static async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  static async clear() {
    if (!this.db) await this.initialize();
    
    // Clear all tables
    const tables = ['comments', 'posts', 'refresh_tokens', 'users', 'products', 'categories'];
    for (const table of tables) {
      await this.db.run(`DELETE FROM ${table}`);
    }
  }

  static async seed(data = {}) {
    if (!this.db) await this.initialize();

    // Seed users
    if (data.users) {
      for (const user of data.users) {
        await this.db.run(
          `INSERT INTO users (username, email, password, firstName, lastName, role, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [user.username, user.email, user.password, user.firstName, user.lastName, user.role || 'user', 1]
        );
      }
    }

    // Seed posts
    if (data.posts) {
      for (const post of data.posts) {
        await this.db.run(
          `INSERT INTO posts (title, content, userId, status) 
           VALUES (?, ?, ?, ?)`,
          [post.title, post.content, post.userId, post.status || 'published']
        );
      }
    }

    // Seed products
    if (data.products) {
      for (const product of data.products) {
        await this.db.run(
          `INSERT INTO products (name, description, price, stock, category, sku) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [product.name, product.description, product.price, product.stock, product.category, product.sku]
        );
      }
    }
  }

  static async createTestUser(userData = {}) {
    const defaultUser = {
      username: `testuser-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      password: '$2b$10$YourHashedPasswordHere',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      is_active: 1
    };

    const user = { ...defaultUser, ...userData };
    
    const result = await this.db.run(
      `INSERT INTO users (username, email, password, firstName, lastName, role, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.username, user.email, user.password, user.firstName, user.lastName, user.role, user.is_active]
    );

    return { id: result.lastID, ...user };
  }
}

// For backwards compatibility
export const testDb = DatabaseHelper;