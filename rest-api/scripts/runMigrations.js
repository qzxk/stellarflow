import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Database } from '../src/config/postgres.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  }

  async initialize() {
    await Database.initialize();
    await this.createMigrationsTable();
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await Database.query(query);
  }

  async getExecutedMigrations() {
    const query = 'SELECT filename FROM migrations ORDER BY filename';
    const results = await Database.all(query);
    return results.map(row => row.filename);
  }

  async getMigrationFiles() {
    const files = await fs.readdir(this.migrationsDir);
    return files
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  async executeMigration(filename) {
    const filepath = path.join(this.migrationsDir, filename);
    const sql = await fs.readFile(filepath, 'utf8');

    console.log(`\n📄 Executing migration: ${filename}`);

    try {
      // Execute migration in a transaction
      await Database.transaction(async (client) => {
        // Split by semicolons but be careful with functions/triggers
        const statements = this.splitSQLStatements(sql);
        
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (trimmed) {
            await client.query(trimmed);
          }
        }

        // Record migration as executed
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
      });

      console.log(`✅ Migration executed successfully: ${filename}`);
      return true;
    } catch (error) {
      console.error(`❌ Error executing migration ${filename}:`, error.message);
      throw error;
    }
  }

  splitSQLStatements(sql) {
    // This is a simple implementation. For production, consider using a proper SQL parser
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // Handle string literals
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }

      // Check for function/trigger definitions
      if (!inString) {
        const remainingSql = sql.substring(i).toLowerCase();
        if (remainingSql.startsWith('create function') || 
            remainingSql.startsWith('create or replace function') ||
            remainingSql.startsWith('create trigger')) {
          inFunction = true;
        } else if (inFunction && remainingSql.startsWith('$$') && i > 0) {
          // PostgreSQL dollar quoting
          const endIndex = sql.indexOf('$$', i + 2);
          if (endIndex !== -1) {
            currentStatement += sql.substring(i, endIndex + 2);
            i = endIndex + 1;
            continue;
          }
        } else if (inFunction && char === ';' && nextChar === '\n') {
          inFunction = false;
        }
      }

      currentStatement += char;

      // Split on semicolon if not in function or string
      if (!inString && !inFunction && char === ';') {
        statements.push(currentStatement);
        currentStatement = '';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement);
    }

    return statements;
  }

  async runPendingMigrations() {
    console.log('🔄 Running database migrations...\n');

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations to run');
      return 0;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(file => console.log(`  - ${file}`));

    let successCount = 0;
    for (const migration of pendingMigrations) {
      try {
        await this.executeMigration(migration);
        successCount++;
      } catch (error) {
        console.error(`\n❌ Migration failed. Stopping execution.`);
        break;
      }
    }

    console.log(`\n✅ Successfully executed ${successCount} migration(s)`);
    return successCount;
  }

  async rollback(steps = 1) {
    console.log(`🔄 Rolling back ${steps} migration(s)...\n`);
    
    // This is a simple implementation. In production, you'd want
    // to store rollback scripts or use a more sophisticated approach
    console.log('⚠️  Rollback not implemented. Please manually revert changes.');
    console.log('    Consider using a migration tool like node-pg-migrate for production.');
  }

  async status() {
    console.log('📊 Migration Status\n');

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();

    console.log('Executed migrations:');
    if (executedMigrations.length === 0) {
      console.log('  (none)');
    } else {
      executedMigrations.forEach(file => console.log(`  ✅ ${file}`));
    }

    console.log('\nPending migrations:');
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    if (pendingMigrations.length === 0) {
      console.log('  (none)');
    } else {
      pendingMigrations.forEach(file => console.log(`  ⏳ ${file}`));
    }

    console.log(`\nTotal: ${migrationFiles.length} migrations`);
    console.log(`Executed: ${executedMigrations.length}`);
    console.log(`Pending: ${pendingMigrations.length}`);
  }

  async close() {
    await Database.close();
  }
}

// CLI handling
async function main() {
  const command = process.argv[2] || 'up';
  const runner = new MigrationRunner();

  try {
    await runner.initialize();

    switch (command) {
      case 'up':
      case 'migrate':
        await runner.runPendingMigrations();
        break;
      
      case 'down':
      case 'rollback':
        const steps = parseInt(process.argv[3]) || 1;
        await runner.rollback(steps);
        break;
      
      case 'status':
        await runner.status();
        break;
      
      case 'create':
        const name = process.argv[3];
        if (!name) {
          console.error('❌ Please provide a migration name');
          process.exit(1);
        }
        await createMigrationFile(name);
        break;
      
      default:
        console.log('Usage: node runMigrations.js [command] [options]');
        console.log('\nCommands:');
        console.log('  up, migrate     Run pending migrations');
        console.log('  down, rollback  Rollback migrations (not implemented)');
        console.log('  status          Show migration status');
        console.log('  create <name>   Create a new migration file');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

async function createMigrationFile(name) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filepath = path.join(__dirname, '..', 'database', 'migrations', filename);
  
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
`;

  await fs.writeFile(filepath, template);
  console.log(`✅ Created migration file: ${filename}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MigrationRunner;