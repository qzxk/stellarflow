#!/usr/bin/env node

import { Database } from '../src/config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Migration {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.migrationTable = 'schema_migrations';
  }

  async initialize() {
    try {
      // Initialize database
      await Database.initialize();
      
      // Create migrations table
      await this.createMigrationsTable();
      
      console.log('Migration system initialized');
    } catch (error) {
      console.error('Failed to initialize migration system:', error);
      throw error;
    }
  }

  async createMigrationsTable() {
    const createTable = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await Database.run(createTable);
  }

  async getExecutedMigrations() {
    const sql = `SELECT version FROM ${this.migrationTable} ORDER BY version`;
    const migrations = await Database.query(sql);
    return migrations.map(m => m.version);
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('Migrations directory does not exist, creating it...');
        await fs.mkdir(this.migrationsPath, { recursive: true });
        return [];
      }
      throw error;
    }
  }

  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    const version = filename.split('_')[0];
    const name = filename.replace('.js', '');

    try {
      const migration = await import(migrationPath);
      
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${filename} does not export an 'up' function`);
      }

      console.log(`Executing migration: ${name}`);
      await migration.up(Database);

      // Record migration
      await Database.run(
        `INSERT INTO ${this.migrationTable} (version, name) VALUES (?, ?)`,
        [version, name]
      );

      console.log(`✅ Migration ${name} completed`);
    } catch (error) {
      console.error(`❌ Migration ${name} failed:`, error);
      throw error;
    }
  }

  async rollbackMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);
    const version = filename.split('_')[0];
    const name = filename.replace('.js', '');

    try {
      const migration = await import(migrationPath);
      
      if (typeof migration.down !== 'function') {
        throw new Error(`Migration ${filename} does not export a 'down' function`);
      }

      console.log(`Rolling back migration: ${name}`);
      await migration.down(Database);

      // Remove migration record
      await Database.run(
        `DELETE FROM ${this.migrationTable} WHERE version = ?`,
        [version]
      );

      console.log(`✅ Migration ${name} rolled back`);
    } catch (error) {
      console.error(`❌ Rollback ${name} failed:`, error);
      throw error;
    }
  }

  async run() {
    try {
      await this.initialize();
      
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();
      
      const pendingMigrations = migrationFiles.filter(
        file => !executedMigrations.includes(file.split('_')[0])
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);
      
      for (const filename of pendingMigrations) {
        await this.executeMigration(filename);
      }

      console.log('🎉 All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      await Database.close();
    }
  }

  async rollback(steps = 1) {
    try {
      await this.initialize();
      
      const executedMigrations = await Database.query(
        `SELECT version, name FROM ${this.migrationTable} ORDER BY version DESC LIMIT ?`,
        [steps]
      );

      if (executedMigrations.length === 0) {
        console.log('No migrations to rollback');
        return;
      }

      const migrationFiles = await this.getMigrationFiles();
      
      for (const migration of executedMigrations) {
        const filename = migrationFiles.find(f => f.startsWith(migration.version));
        if (filename) {
          await this.rollbackMigration(filename);
        }
      }

      console.log(`🎉 Rolled back ${executedMigrations.length} migrations`);
    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    } finally {
      await Database.close();
    }
  }

  async status() {
    try {
      await this.initialize();
      
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = await this.getMigrationFiles();
      
      console.log('Migration Status:');
      console.log('================');
      
      for (const file of migrationFiles) {
        const version = file.split('_')[0];
        const status = executedMigrations.includes(version) ? '✅' : '⭕';
        console.log(`${status} ${file}`);
      }
      
      const pendingCount = migrationFiles.filter(
        file => !executedMigrations.includes(file.split('_')[0])
      ).length;
      
      console.log(`\nExecuted: ${executedMigrations.length}`);
      console.log(`Pending: ${pendingCount}`);
    } catch (error) {
      console.error('Status check failed:', error);
      process.exit(1);
    } finally {
      await Database.close();
    }
  }

  async createMigration(name) {
    if (!name) {
      console.error('Please provide a migration name');
      process.exit(1);
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
    const migrationPath = path.join(this.migrationsPath, filename);

    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export async function up(database) {
  // Add your migration logic here
  // Example:
  // await database.run(\`
  //   ALTER TABLE users ADD COLUMN phone VARCHAR(20)
  // \`);
}

export async function down(database) {
  // Add your rollback logic here
  // Example:
  // await database.run(\`
  //   ALTER TABLE users DROP COLUMN phone
  // \`);
}
`;

    try {
      await fs.mkdir(this.migrationsPath, { recursive: true });
      await fs.writeFile(migrationPath, template);
      console.log(`✅ Created migration: ${filename}`);
    } catch (error) {
      console.error('Failed to create migration:', error);
      process.exit(1);
    }
  }
}

// CLI handling
const migration = new Migration();
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'run':
  case 'up':
    migration.run();
    break;
  case 'rollback':
  case 'down':
    const steps = parseInt(args[0]) || 1;
    migration.rollback(steps);
    break;
  case 'status':
    migration.status();
    break;
  case 'create':
    const name = args.join(' ');
    migration.createMigration(name);
    break;
  default:
    console.log('Usage:');
    console.log('  node migrate.js run                    - Run pending migrations');
    console.log('  node migrate.js rollback [steps]       - Rollback migrations');
    console.log('  node migrate.js status                 - Show migration status');
    console.log('  node migrate.js create <name>          - Create new migration');
    break;
}