const fs = require('fs');
const path = require('path');

module.exports = {
  up: async (client) => {
    // Read and execute the schema file
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    console.log('Initial schema created successfully');
  },

  down: async (client) => {
    // Drop all tables in reverse order of dependencies
    await client.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;
      DROP FUNCTION IF EXISTS cleanup_expired_tokens() CASCADE;
      DROP VIEW IF EXISTS active_users CASCADE;
      DROP VIEW IF EXISTS available_products CASCADE;
    `);
    console.log('Schema dropped successfully');
  }
};