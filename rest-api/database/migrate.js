const { pool, transaction } = require('./connection');
const fs = require('fs').promises;
const path = require('path');

// Create migrations table if it doesn't exist
async function createMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Get list of executed migrations
async function getExecutedMigrations() {
  const result = await pool.query('SELECT filename FROM migrations ORDER BY filename');
  return result.rows.map(row => row.filename);
}

// Get list of migration files
async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  return files
    .filter(file => file.endsWith('.js'))
    .sort();
}

// Run a single migration
async function runMigration(filename) {
  const migrationPath = path.join(__dirname, 'migrations', filename);
  const migration = require(migrationPath);

  if (!migration.up) {
    throw new Error(`Migration ${filename} does not export an 'up' function`);
  }

  await transaction(async (client) => {
    console.log(`Running migration: ${filename}`);
    await migration.up(client);
    
    // Record migration as executed
    await client.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    
    console.log(`Completed migration: ${filename}`);
  });
}

// Run all pending migrations
async function runMigrations() {
  try {
    await createMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    const migrationFiles = await getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Rollback last migration
async function rollbackMigration() {
  try {
    const executedMigrations = await getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migrationPath = path.join(__dirname, 'migrations', lastMigration);
    const migration = require(migrationPath);

    if (!migration.down) {
      throw new Error(`Migration ${lastMigration} does not export a 'down' function`);
    }

    await transaction(async (client) => {
      console.log(`Rolling back migration: ${lastMigration}`);
      await migration.down(client);
      
      // Remove migration record
      await client.query(
        'DELETE FROM migrations WHERE filename = $1',
        [lastMigration]
      );
      
      console.log(`Rolled back migration: ${lastMigration}`);
    });
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'up':
      runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    case 'down':
      rollbackMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      console.log('Usage: node migrate.js [up|down]');
      console.log('  up   - Run all pending migrations');
      console.log('  down - Rollback the last migration');
      process.exit(1);
  }
}

module.exports = {
  runMigrations,
  rollbackMigration
};