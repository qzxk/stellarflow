# REST API Architecture Design
## Claude Flow System Architecture

### Overview
This document outlines the REST API architecture for the Claude Flow system, a Node.js/TypeScript-based AI agent orchestration platform with ruv-swarm integration.

### Technology Stack

#### Core Technologies
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3+
- **Package Manager**: npm 9+
- **Architecture**: RESTful API with MCP (Model Context Protocol) integration

#### Frameworks & Libraries
- **Web Framework**: Express.js 4.18+
- **Database**: Better-SQLite3 12.2+ (embedded SQLite)
- **Authentication**: JWT-based authentication
- **WebSocket**: ws 8.18+ for real-time communication
- **Process Management**: node-pty 1.0+ for terminal operations
- **UI**: Blessed 0.1.81 for CLI interfaces

#### Development Tools
- **Testing**: Jest 29.7+
- **Build**: TypeScript Compiler (tsc)
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier 3.1+

### System Architecture

#### High-Level Components
1. **API Gateway Layer** - Express.js REST endpoints
2. **MCP Integration Layer** - Model Context Protocol handling
3. **Swarm Orchestration Layer** - Multi-agent coordination
4. **Memory Management Layer** - Persistent storage and caching
5. **Terminal Management Layer** - Command execution and process handling
6. **WebSocket Layer** - Real-time communication
7. **Authentication Layer** - Security and access control

#### Directory Structure
```
src/
├── api/                    # REST API routes and controllers
├── mcp/                    # MCP protocol implementation
├── swarm/                  # Agent orchestration logic
├── memory/                 # Memory management and persistence
├── terminal/               # Terminal and process management
├── coordination/           # Agent coordination and messaging
├── cli/                    # Command-line interface
├── monitoring/             # Health checks and diagnostics
└── types/                  # TypeScript type definitions
```

### Database Schema Design

#### Core Tables

**agents**
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'idle',
  capabilities TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**swarms**
```sql
CREATE TABLE swarms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topology TEXT NOT NULL,
  status TEXT DEFAULT 'initializing',
  max_agents INTEGER DEFAULT 5,
  strategy TEXT DEFAULT 'balanced',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**tasks**
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  swarm_id TEXT,
  agent_id TEXT,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (swarm_id) REFERENCES swarms(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

**memory_entries**
```sql
CREATE TABLE memory_entries (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT, -- JSON data
  ttl INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  UNIQUE(namespace, key)
);
```

**sessions**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  data TEXT, -- JSON session data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);
```

#### Indexes
```sql
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX idx_memory_namespace ON memory_entries(namespace);
CREATE INDEX idx_memory_expires ON memory_entries(expires_at);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Authentication Strategy

#### JWT-Based Authentication
- **Token Type**: JSON Web Tokens (JWT)
- **Signing Algorithm**: HS256 (HMAC SHA256)
- **Token Expiry**: 24 hours (configurable)
- **Refresh Token**: 7 days (configurable)

#### Authentication Flow
1. Client requests authentication with credentials
2. Server validates credentials
3. Server generates JWT access token and refresh token
4. Client includes JWT in Authorization header for subsequent requests
5. Server validates JWT on each protected endpoint
6. Client can refresh token using refresh token when expired

#### Security Headers
- `helmet` middleware for security headers
- CORS configuration for cross-origin requests
- Rate limiting for API endpoints
- Input validation and sanitization

### API Endpoints Specification

#### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

#### Swarm Management
```
POST   /api/swarms                 # Create new swarm
GET    /api/swarms                 # List all swarms
GET    /api/swarms/:id             # Get swarm details
PUT    /api/swarms/:id             # Update swarm
DELETE /api/swarms/:id             # Delete swarm
POST   /api/swarms/:id/start       # Start swarm
POST   /api/swarms/:id/stop        # Stop swarm
GET    /api/swarms/:id/status      # Get swarm status
GET    /api/swarms/:id/metrics     # Get swarm metrics
```

#### Agent Management
```
POST   /api/agents                 # Spawn new agent
GET    /api/agents                 # List all agents
GET    /api/agents/:id             # Get agent details
PUT    /api/agents/:id             # Update agent
DELETE /api/agents/:id             # Remove agent
GET    /api/agents/:id/status      # Get agent status
GET    /api/agents/:id/metrics     # Get agent metrics
POST   /api/agents/:id/assign      # Assign task to agent
```

#### Task Orchestration
```
POST   /api/tasks                  # Create new task
GET    /api/tasks                  # List all tasks
GET    /api/tasks/:id              # Get task details
PUT    /api/tasks/:id              # Update task
DELETE /api/tasks/:id              # Cancel task
GET    /api/tasks/:id/status       # Get task status
GET    /api/tasks/:id/results      # Get task results
POST   /api/tasks/orchestrate      # Orchestrate complex task
```

#### Memory Management
```
POST   /api/memory                 # Store memory entry
GET    /api/memory                 # List memory entries
GET    /api/memory/:namespace      # Get entries by namespace
GET    /api/memory/:namespace/:key # Get specific entry
PUT    /api/memory/:namespace/:key # Update memory entry
DELETE /api/memory/:namespace/:key # Delete memory entry
POST   /api/memory/search          # Search memory entries
```

#### Neural Network Operations
```
GET    /api/neural/status          # Get neural status
POST   /api/neural/train           # Train neural patterns
GET    /api/neural/patterns        # Get cognitive patterns
POST   /api/neural/predict         # Make predictions
```

#### System Operations
```
GET    /api/system/health          # Health check
GET    /api/system/metrics         # System metrics
GET    /api/system/features        # Available features
POST   /api/system/benchmark       # Run benchmarks
GET    /api/system/diagnostics     # System diagnostics
```

#### GitHub Integration
```
POST   /api/github/repo/analyze    # Analyze repository
POST   /api/github/pr/enhance      # Enhance pull request
POST   /api/github/issue/triage    # Triage issues
POST   /api/github/code/review     # Code review
GET    /api/github/metrics         # GitHub metrics
```

#### WebSocket Endpoints
```
WS     /ws/swarm/:id               # Real-time swarm monitoring
WS     /ws/tasks/:id               # Real-time task updates
WS     /ws/agents/:id              # Real-time agent status
WS     /ws/system                  # System-wide notifications
```

### Request/Response Formats

#### Standard Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2025-07-23T11:47:15.205Z",
  "requestId": "req-123456789"
}
```

#### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {}
  },
  "timestamp": "2025-07-23T11:47:15.205Z",
  "requestId": "req-123456789"
}
```

### Performance Considerations

#### Caching Strategy
- In-memory caching for frequently accessed data
- SQLite WAL mode for better concurrent access
- Connection pooling for database operations
- Response caching for expensive operations

#### Scalability Features
- Horizontal scaling through multiple instances
- Load balancing for API endpoints
- Background job processing for long-running tasks
- WebSocket connection management

#### Monitoring & Observability
- Request/response logging
- Performance metrics collection
- Error tracking and alerting
- Health check endpoints
- Real-time dashboard for system status

### Security Considerations

#### Input Validation
- Strict parameter validation for all endpoints
- SQL injection prevention through parameterized queries
- XSS protection through input sanitization
- File upload restrictions and validation

#### Access Control
- Role-based access control (RBAC)
- API rate limiting
- IP whitelisting for sensitive operations
- Audit logging for all operations

#### Data Protection
- Encryption at rest for sensitive data
- Secure token storage and transmission
- Regular security updates and patches
- Secure defaults for all configurations

### Next Steps
1. Implement core Express.js application structure
2. Set up database schema and migrations
3. Implement authentication middleware
4. Create API route handlers
5. Add WebSocket support for real-time features
6. Implement comprehensive testing suite
7. Add monitoring and logging
8. Create deployment configuration