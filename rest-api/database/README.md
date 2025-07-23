# Database Setup for REST API

This directory contains the PostgreSQL database schema, models, and utilities for the REST API.

## Overview

The database is designed with the following key features:
- PostgreSQL with UUID primary keys
- Comprehensive indexing for performance
- Audit logging for all changes
- Secure password hashing with bcrypt
- JWT refresh token management
- Soft deletes for data integrity
- Database migrations support

## Schema

### Tables

1. **users**
   - Stores user accounts with authentication details
   - Supports roles: user, admin, moderator
   - Email verification and password reset tokens
   - Soft delete via `is_active` flag

2. **products**
   - Product catalog with inventory tracking
   - Tags array for flexible categorization
   - Foreign key to users for ownership
   - Stock quantity management

3. **refresh_tokens**
   - JWT refresh token management
   - Device tracking and token rotation
   - Automatic cleanup of expired tokens

4. **audit_logs**
   - Tracks all changes to users and products
   - Stores old and new values as JSONB
   - Links changes to the user who made them

### Views

- **active_users**: Shows only verified and active users
- **available_products**: Shows products in stock with creator info

## Setup Instructions

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Start PostgreSQL
sudo service postgresql start  # Linux
brew services start postgresql  # macOS
```

### 2. Create Database

```bash
# Access PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE rest_api_db;
CREATE USER api_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rest_api_db TO api_user;
\q
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rest_api_db
DB_USER=api_user
DB_PASSWORD=your_secure_password

# Connection Pool
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Environment
NODE_ENV=development
```

### 4. Run Migrations

```bash
# Install dependencies
cd rest-api
npm install pg bcryptjs

# Run migrations
node database/migrate.js up

# To rollback last migration
node database/migrate.js down
```

### 5. Seed Database (Optional)

```bash
# Add sample data
node database/seed.js
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Test users: `john.doe@example.com` / `password123`
- Sample products with various categories

## Model Usage

### User Model

```javascript
const { User } = require('./database/models');

// Create user
const user = await User.create({
  email: 'user@example.com',
  password: 'securepassword',
  fullName: 'John Doe'
});

// Find user
const user = await User.findByEmail('user@example.com');

// Verify password
const isValid = await user.checkPassword('password');

// Update user
await user.update({ fullName: 'Jane Doe' });
```

### Product Model

```javascript
const { Product } = require('./database/models');

// Create product
const product = await Product.create({
  name: 'New Product',
  description: 'Description',
  price: 99.99,
  category: 'Electronics',
  tags: ['new', 'featured'],
  createdBy: userId
});

// Search products
const products = await Product.list({
  category: 'Electronics',
  minPrice: 50,
  maxPrice: 200,
  search: 'laptop'
});

// Update stock
await product.adjustStock(-5); // Decrease by 5
```

### RefreshToken Model

```javascript
const { RefreshToken } = require('./database/models');

// Create token
const { refreshToken, token } = await RefreshToken.create({
  userId: user.id,
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip
});

// Rotate token
const { refreshToken: newToken, token: newTokenString } = 
  await RefreshToken.rotate(oldToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip
  });

// Revoke all tokens for user
await RefreshToken.revokeAllForUser(userId);
```

## Database Connection

The connection module provides:
- Connection pooling
- Transaction support
- Query helpers
- Automatic error handling
- Graceful shutdown

```javascript
const { query, transaction } = require('./database/connection');

// Simple query
const result = await query('SELECT * FROM users WHERE email = $1', [email]);

// Transaction
const result = await transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  return 'success';
});
```

## Maintenance

### Clean Up Expired Tokens

Run periodically (e.g., via cron job):

```javascript
const { cleanupExpiredTokens } = require('./database/connection');
await cleanupExpiredTokens();
```

### Monitor Slow Queries

In development, queries slower than 100ms are logged automatically.

### Backup

```bash
# Backup database
pg_dump -U api_user -h localhost rest_api_db > backup.sql

# Restore database
psql -U api_user -h localhost rest_api_db < backup.sql
```

## Security Considerations

1. **Passwords**: Never stored in plain text, always hashed with bcrypt
2. **Tokens**: Refresh tokens are hashed before storage
3. **SQL Injection**: All queries use parameterized statements
4. **Audit Trail**: All changes are logged with user attribution
5. **Permissions**: Use least-privilege database user in production

## Performance Optimization

1. **Indexes**: Created on all foreign keys and commonly queried fields
2. **Connection Pooling**: Reuses database connections
3. **Views**: Pre-defined for common queries
4. **JSONB**: Used for flexible audit log storage
5. **GIN Index**: For efficient array searches on product tags

## Troubleshooting

### Connection Issues

1. Check PostgreSQL is running: `sudo service postgresql status`
2. Verify credentials in `.env` file
3. Check firewall allows port 5432
4. Review PostgreSQL logs: `/var/log/postgresql/`

### Migration Errors

1. Check migration files are valid JavaScript
2. Ensure database user has CREATE/DROP permissions
3. Manually check migrations table if needed

### Performance Issues

1. Run `EXPLAIN ANALYZE` on slow queries
2. Check for missing indexes
3. Monitor connection pool usage
4. Consider query optimization or caching