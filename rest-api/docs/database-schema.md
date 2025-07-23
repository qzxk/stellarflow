# Database Schema Documentation

## Overview
PostgreSQL database schema for the REST API with focus on scalability, performance, and data integrity.

## Database Configuration

### Connection Settings
```yaml
database:
  host: ${DB_HOST}
  port: ${DB_PORT}
  name: ${DB_NAME}
  user: ${DB_USER}
  password: ${DB_PASSWORD}
  pool:
    min: 2
    max: 10
    idleTimeout: 30000
  ssl:
    enabled: true
    rejectUnauthorized: true
```

## Core Tables

### users
Stores user account information with soft delete support.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  roles TEXT[] DEFAULT ARRAY['user'],
  metadata JSONB DEFAULT '{}',
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_roles ON users USING GIN(roles);
CREATE INDEX idx_users_metadata ON users USING GIN(metadata);
```

### products
Product catalog with inventory tracking and flexible metadata.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10,2),
  cost DECIMAL(10,2),
  category_id UUID REFERENCES categories(id),
  brand_id UUID REFERENCES brands(id),
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER DEFAULT 10,
  weight DECIMAL(10,3),
  dimensions JSONB DEFAULT '{"length": null, "width": null, "height": null}',
  images JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT price_compare CHECK (compare_at_price IS NULL OR compare_at_price > price)
);

CREATE INDEX idx_products_slug ON products(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_brand ON products(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku ON products(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active ON products(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_metadata ON products USING GIN(metadata);
CREATE INDEX idx_products_price ON products(price) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_products_created ON products(created_at DESC) WHERE deleted_at IS NULL;
```

### categories
Hierarchical product categories.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  image_url VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT no_self_parent CHECK (id != parent_id)
);

CREATE INDEX idx_categories_slug ON categories(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_active ON categories(is_active) WHERE deleted_at IS NULL;
```

### reviews
Product reviews with ratings.

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,
  pros TEXT[],
  cons TEXT[],
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT unique_user_product_review UNIQUE(user_id, product_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_user ON reviews(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_rating ON reviews(rating) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_created ON reviews(created_at DESC) WHERE deleted_at IS NULL;
```

### refresh_tokens
JWT refresh token storage for token rotation.

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  
  CONSTRAINT token_not_expired CHECK (expires_at > CURRENT_TIMESTAMP)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### api_keys
API key management for service-to-service authentication.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE deleted_at IS NULL;
```

### audit_logs
Comprehensive audit trail for all system actions.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  changes JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  request_id UUID,
  duration_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_request ON audit_logs(request_id);

-- Partition by month for better performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Supporting Tables

### brands
Product brands/manufacturers.

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  website_url VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### user_sessions
Active user sessions for security tracking.

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
```

### permissions
Fine-grained permission definitions.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_resource_action UNIQUE(resource, action)
);

-- Sample permissions
INSERT INTO permissions (resource, action, description) VALUES
  ('users', 'read', 'View user information'),
  ('users', 'write', 'Create or update users'),
  ('users', 'delete', 'Delete users'),
  ('products', 'read', 'View products'),
  ('products', 'write', 'Create or update products'),
  ('products', 'delete', 'Delete products');
```

### role_permissions
Many-to-many relationship between roles and permissions.

```sql
CREATE TABLE role_permissions (
  role VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (role, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);
```

## Functions and Triggers

### Updated Timestamp Trigger
Automatically update the updated_at timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Soft Delete Function
Helper function for soft deletes.

```sql
CREATE OR REPLACE FUNCTION soft_delete(table_name text, record_id uuid)
RETURNS void AS $$
BEGIN
    EXECUTE format('UPDATE %I SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', table_name)
    USING record_id;
END;
$$ LANGUAGE plpgsql;
```

### Product Search Function
Full-text search for products.

```sql
CREATE OR REPLACE FUNCTION search_products(search_query text, limit_count integer DEFAULT 20)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    price DECIMAL,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        ts_rank(
            to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM products p
    WHERE 
        p.deleted_at IS NULL 
        AND p.is_active = true
        AND to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) 
            @@ plainto_tsquery('english', search_query)
    ORDER BY rank DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create text search index
CREATE INDEX idx_products_search ON products 
USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')))
WHERE deleted_at IS NULL AND is_active = true;
```

## Views

### Active Users View
```sql
CREATE VIEW v_active_users AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.roles,
    u.last_login_at,
    u.created_at,
    COUNT(DISTINCT s.id) as active_sessions
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.expires_at > CURRENT_TIMESTAMP
WHERE u.deleted_at IS NULL AND u.is_active = true
GROUP BY u.id;
```

### Product Summary View
```sql
CREATE VIEW v_product_summary AS
SELECT 
    p.id,
    p.name,
    p.slug,
    p.price,
    p.stock_quantity,
    c.name as category_name,
    b.name as brand_name,
    COALESCE(AVG(r.rating), 0) as average_rating,
    COUNT(DISTINCT r.id) as review_count,
    p.created_at,
    p.updated_at
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
LEFT JOIN reviews r ON p.id = r.product_id AND r.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id, c.name, b.name;
```

## Indexes Strategy

### Performance Indexes
- Primary keys: B-tree indexes automatically created
- Foreign keys: Index on referencing column
- Unique constraints: Unique indexes automatically created
- Frequently queried columns: B-tree indexes
- JSON columns: GIN indexes for JSONB queries
- Array columns: GIN indexes for array operations
- Text search: GIN indexes with tsvector

### Maintenance
```sql
-- Analyze tables regularly
ANALYZE users, products, reviews, audit_logs;

-- Reindex periodically
REINDEX TABLE products;

-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Migration Strategy

### Version Control
- Use sequential migration files (001_initial_schema.sql, 002_add_reviews.sql)
- Each migration must be reversible
- Track applied migrations in migrations table

### Migration Table
```sql
CREATE TABLE migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sample Migration
```sql
-- 001_initial_schema.up.sql
BEGIN;
CREATE TABLE users (...);
CREATE TABLE products (...);
COMMIT;

-- 001_initial_schema.down.sql
BEGIN;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
COMMIT;
```

## Performance Considerations

### Connection Pooling
- Use PgBouncer or application-level pooling
- Pool size: 10-20 connections per app instance
- Idle timeout: 30 seconds

### Query Optimization
- Use EXPLAIN ANALYZE for slow queries
- Avoid N+1 queries with proper joins
- Use CTEs for complex queries
- Implement query result caching

### Partitioning
- Partition audit_logs by month
- Consider partitioning large tables by date or ID
- Use declarative partitioning (PostgreSQL 10+)

### Maintenance Tasks
```sql
-- Daily vacuum
VACUUM ANALYZE;

-- Weekly reindex
REINDEX DATABASE your_database;

-- Monthly full vacuum (during maintenance window)
VACUUM FULL;
```