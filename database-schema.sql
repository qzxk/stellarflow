-- Claude Flow Database Schema
-- SQLite Database Schema for Claude Flow System v2.0.0
-- Created: 2025-07-23

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Enable WAL mode for better concurrent access
PRAGMA journal_mode = WAL;

-- Set synchronous mode for better performance
PRAGMA synchronous = NORMAL;

-- Set cache size (in KB)
PRAGMA cache_size = -2000;

-- ============================================================================
-- CORE SYSTEM TABLES
-- ============================================================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for JWT management
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- SWARM ORCHESTRATION TABLES
-- ============================================================================

-- Swarms table for managing swarm instances
CREATE TABLE IF NOT EXISTS swarms (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    topology TEXT NOT NULL CHECK (topology IN ('mesh', 'hierarchical', 'ring', 'star')),
    status TEXT DEFAULT 'initializing' CHECK (status IN ('initializing', 'active', 'idle', 'stopping', 'stopped', 'error')),
    max_agents INTEGER DEFAULT 5 CHECK (max_agents > 0 AND max_agents <= 50),
    strategy TEXT DEFAULT 'balanced' CHECK (strategy IN ('balanced', 'specialized', 'adaptive')),
    configuration TEXT, -- JSON configuration
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    stopped_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Agents table for managing individual agents
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    swarm_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist')),
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'error', 'stopping', 'stopped')),
    capabilities TEXT, -- JSON array of capabilities
    cognitive_pattern TEXT CHECK (cognitive_pattern IN ('convergent', 'divergent', 'lateral', 'systems', 'critical', 'adaptive')),
    learning_rate REAL DEFAULT 0.5 CHECK (learning_rate >= 0.0 AND learning_rate <= 1.0),
    enable_memory BOOLEAN DEFAULT true,
    configuration TEXT, -- JSON configuration
    performance_stats TEXT, -- JSON performance statistics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- Tasks table for task management
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    swarm_id TEXT NOT NULL,
    parent_task_id TEXT, -- For subtasks
    assigned_agent_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'timeout')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    strategy TEXT CHECK (strategy IN ('parallel', 'sequential', 'adaptive', 'balanced')),
    dependencies TEXT, -- JSON array of task dependencies
    input_data TEXT, -- JSON input parameters
    output_data TEXT, -- JSON output results
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    estimated_duration INTEGER, -- seconds
    actual_duration INTEGER, -- seconds
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 3600,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- Task execution logs
CREATE TABLE IF NOT EXISTS task_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    task_id TEXT NOT NULL,
    agent_id TEXT,
    log_level TEXT DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- ============================================================================
-- MEMORY MANAGEMENT TABLES
-- ============================================================================

-- Memory entries for distributed memory system
CREATE TABLE IF NOT EXISTS memory_entries (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT, -- JSON data
    data_type TEXT DEFAULT 'json' CHECK (data_type IN ('json', 'string', 'number', 'boolean', 'binary')),
    ttl INTEGER, -- Time to live in seconds
    tags TEXT, -- JSON array of tags for categorization
    metadata TEXT, -- JSON metadata
    created_by TEXT, -- Agent or user ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    UNIQUE(namespace, key)
);

-- Memory access logs for audit and optimization
CREATE TABLE IF NOT EXISTS memory_access_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    memory_entry_id TEXT NOT NULL,
    accessor_id TEXT, -- Agent or user ID
    accessor_type TEXT CHECK (accessor_type IN ('agent', 'user', 'system')),
    access_type TEXT CHECK (access_type IN ('read', 'write', 'delete')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE
);

-- ============================================================================
-- COORDINATION AND COMMUNICATION TABLES
-- ============================================================================

-- Agent coordination events
CREATE TABLE IF NOT EXISTS coordination_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    swarm_id TEXT NOT NULL,
    source_agent_id TEXT,
    target_agent_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('message', 'task_handoff', 'resource_request', 'status_update', 'coordination_sync')),
    payload TEXT, -- JSON event data
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'received', 'processed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (source_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- Inter-agent messages
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    swarm_id TEXT NOT NULL,
    from_agent_id TEXT NOT NULL,
    to_agent_id TEXT,
    message_type TEXT DEFAULT 'info' CHECK (message_type IN ('info', 'request', 'response', 'error', 'broadcast')),
    subject TEXT,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON metadata
    is_read BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE,
    FOREIGN KEY (from_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (to_agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ============================================================================
-- NEURAL NETWORK AND LEARNING TABLES
-- ============================================================================

-- Neural models for pattern recognition and optimization
CREATE TABLE IF NOT EXISTS neural_models (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('coordination', 'optimization', 'prediction', 'classification')),
    status TEXT DEFAULT 'training' CHECK (status IN ('training', 'ready', 'updating', 'error')),
    architecture TEXT, -- JSON model architecture
    parameters TEXT, -- JSON model parameters
    accuracy REAL CHECK (accuracy >= 0.0 AND accuracy <= 1.0),
    training_data_size INTEGER DEFAULT 0,
    training_epochs INTEGER DEFAULT 0,
    last_trained DATETIME,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Training data for neural models
CREATE TABLE IF NOT EXISTS neural_training_data (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    model_id TEXT NOT NULL,
    input_data TEXT NOT NULL, -- JSON input features
    expected_output TEXT NOT NULL, -- JSON expected results
    actual_output TEXT, -- JSON actual results (if available)
    training_round INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES neural_models(id) ON DELETE CASCADE
);

-- Learning patterns and insights
CREATE TABLE IF NOT EXISTS learning_patterns (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT,
    swarm_id TEXT,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('coordination', 'task_execution', 'error_recovery', 'optimization')),
    pattern_data TEXT NOT NULL, -- JSON pattern information
    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    usage_count INTEGER DEFAULT 0,
    success_rate REAL CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE CASCADE
);

-- ============================================================================
-- PERFORMANCE AND MONITORING TABLES
-- ============================================================================

-- System metrics for performance monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network', 'response_time', 'throughput', 'error_rate')),
    component TEXT CHECK (component IN ('system', 'swarm', 'agent', 'task', 'database', 'api')),
    component_id TEXT, -- ID of specific component
    value REAL NOT NULL,
    unit TEXT, -- Unit of measurement
    metadata TEXT, -- JSON additional data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance benchmarks
CREATE TABLE IF NOT EXISTS benchmarks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    benchmark_type TEXT NOT NULL CHECK (benchmark_type IN ('swarm', 'agent', 'task', 'memory', 'neural', 'system')),
    configuration TEXT, -- JSON benchmark configuration
    results TEXT, -- JSON benchmark results
    duration INTEGER, -- Execution time in milliseconds
    iterations INTEGER DEFAULT 1,
    success_rate REAL CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Error tracking
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    component_type TEXT CHECK (component_type IN ('system', 'swarm', 'agent', 'task', 'api', 'database')),
    component_id TEXT,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    severity TEXT DEFAULT 'error' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    context TEXT, -- JSON error context
    resolved BOOLEAN DEFAULT false,
    resolved_at DATETIME,
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- GITHUB INTEGRATION TABLES
-- ============================================================================

-- GitHub repositories
CREATE TABLE IF NOT EXISTS github_repositories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT UNIQUE NOT NULL, -- owner/name
    description TEXT,
    url TEXT,
    default_branch TEXT DEFAULT 'main',
    language TEXT,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    last_sync DATETIME,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    configuration TEXT, -- JSON repository configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GitHub analysis results
CREATE TABLE IF NOT EXISTS github_analyses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    repository_id TEXT NOT NULL,
    swarm_id TEXT,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('code_quality', 'performance', 'security', 'comprehensive')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    results TEXT, -- JSON analysis results
    score REAL CHECK (score >= 0.0 AND score <= 100.0),
    recommendations TEXT, -- JSON recommendations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (repository_id) REFERENCES github_repositories(id) ON DELETE CASCADE,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE SET NULL
);

-- ============================================================================
-- WORKFLOW AND AUTOMATION TABLES
-- ============================================================================

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    version TEXT DEFAULT '1.0.0',
    definition TEXT NOT NULL, -- JSON workflow definition
    triggers TEXT, -- JSON trigger configuration
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'deprecated')),
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workflow_id TEXT NOT NULL,
    swarm_id TEXT,
    trigger_type TEXT CHECK (trigger_type IN ('manual', 'scheduled', 'event', 'api')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    input_data TEXT, -- JSON input parameters
    output_data TEXT, -- JSON execution results
    execution_log TEXT, -- JSON execution log
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration INTEGER, -- seconds
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (swarm_id) REFERENCES swarms(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- User and session indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token_hash);

-- Swarm and agent indexes
CREATE INDEX IF NOT EXISTS idx_swarms_status ON swarms(status);
CREATE INDEX IF NOT EXISTS idx_swarms_created_by ON swarms(created_by);
CREATE INDEX IF NOT EXISTS idx_agents_swarm_id ON agents(swarm_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_level ON task_logs(log_level);

-- Memory indexes
CREATE INDEX IF NOT EXISTS idx_memory_namespace ON memory_entries(namespace);
CREATE INDEX IF NOT EXISTS idx_memory_expires_at ON memory_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_memory_created_by ON memory_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_memory_last_accessed ON memory_entries(last_accessed);
CREATE INDEX IF NOT EXISTS idx_memory_access_logs_entry ON memory_access_logs(memory_entry_id);

-- Coordination indexes
CREATE INDEX IF NOT EXISTS idx_coordination_swarm_id ON coordination_events(swarm_id);
CREATE INDEX IF NOT EXISTS idx_coordination_source ON coordination_events(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_target ON coordination_events(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_type ON coordination_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_swarm ON agent_messages(swarm_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent_id);

-- Neural and learning indexes
CREATE INDEX IF NOT EXISTS idx_neural_models_type ON neural_models(model_type);
CREATE INDEX IF NOT EXISTS idx_neural_models_status ON neural_models(status);
CREATE INDEX IF NOT EXISTS idx_training_data_model ON neural_training_data(model_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_agent ON learning_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_swarm ON learning_patterns(swarm_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(pattern_type);

-- Performance and monitoring indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_component ON system_metrics(component);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_benchmarks_type ON benchmarks(benchmark_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_component ON error_logs(component_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- GitHub integration indexes
CREATE INDEX IF NOT EXISTS idx_github_repos_owner ON github_repositories(owner);
CREATE INDEX IF NOT EXISTS idx_github_repos_sync_status ON github_repositories(sync_status);
CREATE INDEX IF NOT EXISTS idx_github_analyses_repo ON github_analyses(repository_id);
CREATE INDEX IF NOT EXISTS idx_github_analyses_type ON github_analyses(analysis_type);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active swarms with agent counts
CREATE VIEW IF NOT EXISTS v_active_swarms AS
SELECT 
    s.id,
    s.name,
    s.topology,
    s.status,
    s.max_agents,
    COUNT(a.id) as agent_count,
    s.created_at,
    s.updated_at
FROM swarms s
LEFT JOIN agents a ON s.id = a.swarm_id AND a.status != 'stopped'
WHERE s.status IN ('active', 'idle')
GROUP BY s.id, s.name, s.topology, s.status, s.max_agents, s.created_at, s.updated_at;

-- Task summary by swarm
CREATE VIEW IF NOT EXISTS v_swarm_task_summary AS
SELECT 
    s.id as swarm_id,
    s.name as swarm_name,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as active_tasks,
    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    AVG(t.actual_duration) as avg_duration
FROM swarms s
LEFT JOIN tasks t ON s.id = t.swarm_id
GROUP BY s.id, s.name;

-- Agent performance summary
CREATE VIEW IF NOT EXISTS v_agent_performance AS
SELECT 
    a.id,
    a.name,
    a.type,
    a.swarm_id,
    a.status,
    COUNT(t.id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    AVG(t.actual_duration) as avg_task_duration,
    CASE 
        WHEN COUNT(t.id) > 0 THEN 
            ROUND((CAST(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.id)) * 100.0, 2)
        ELSE 0.0
    END as success_rate,
    a.last_active
FROM agents a
LEFT JOIN tasks t ON a.id = t.assigned_agent_id
GROUP BY a.id, a.name, a.type, a.swarm_id, a.status, a.last_active;

-- Memory usage by namespace
CREATE VIEW IF NOT EXISTS v_memory_usage AS
SELECT 
    namespace,
    COUNT(*) as entry_count,
    SUM(LENGTH(value)) as total_size_bytes,
    AVG(access_count) as avg_access_count,
    MIN(created_at) as oldest_entry,
    MAX(updated_at) as newest_entry,
    COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as expiring_entries
FROM memory_entries
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
GROUP BY namespace;

-- ============================================================================
-- TRIGGERS FOR DATA INTEGRITY AND AUTOMATION
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER IF NOT EXISTS tr_users_updated_at
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS tr_swarms_updated_at
    AFTER UPDATE ON swarms
    BEGIN
        UPDATE swarms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS tr_agents_updated_at
    AFTER UPDATE ON agents
    BEGIN
        UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS tr_tasks_updated_at
    AFTER UPDATE ON tasks
    BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS tr_memory_updated_at
    AFTER UPDATE ON memory_entries
    BEGIN
        UPDATE memory_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Cleanup expired memory entries
CREATE TRIGGER IF NOT EXISTS tr_cleanup_expired_memory
    AFTER INSERT ON memory_entries
    WHEN NEW.expires_at IS NOT NULL
    BEGIN
        DELETE FROM memory_entries 
        WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP;
    END;

-- Increment memory access count
CREATE TRIGGER IF NOT EXISTS tr_memory_access_count
    AFTER INSERT ON memory_access_logs
    WHEN NEW.access_type = 'read'
    BEGIN
        UPDATE memory_entries 
        SET 
            access_count = access_count + 1,
            last_accessed = CURRENT_TIMESTAMP
        WHERE id = NEW.memory_entry_id;
    END;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Create default admin user (password should be changed in production)
INSERT OR IGNORE INTO users (id, username, email, password_hash, salt, role) 
VALUES (
    'admin-default',
    'admin',
    'admin@claude-flow.local',
    'pbkdf2$sha256$100000$default-salt$default-hash', -- Replace with proper hash
    'default-salt',
    'admin'
);

-- Create default neural models
INSERT OR IGNORE INTO neural_models (name, model_type, status) VALUES
    ('coordination-model-v1', 'coordination', 'ready'),
    ('optimization-model-v1', 'optimization', 'ready'),
    ('prediction-model-v1', 'prediction', 'ready');

-- ============================================================================
-- DATABASE MAINTENANCE PROCEDURES
-- ============================================================================

-- Clean up old logs (run periodically)
-- DELETE FROM task_logs WHERE created_at < datetime('now', '-30 days');
-- DELETE FROM system_metrics WHERE timestamp < datetime('now', '-7 days');
-- DELETE FROM error_logs WHERE created_at < datetime('now', '-90 days') AND resolved = true;

-- Vacuum and analyze (run periodically for optimization)
-- VACUUM;
-- ANALYZE;

-- ============================================================================
-- SCHEMA VALIDATION
-- ============================================================================

-- Verify foreign key constraints
PRAGMA foreign_key_check;

-- Show table info for verification
-- .schema
-- .tables