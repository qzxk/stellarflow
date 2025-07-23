# REST API Specification
## Claude Flow System API v2.0.0

### Base Configuration
- **Base URL**: `http://localhost:3000/api`
- **API Version**: v2.0.0
- **Content-Type**: `application/json`
- **Authentication**: Bearer Token (JWT)

### Authentication

#### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "expiresIn": 86400,
    "user": {
      "id": "user-123",
      "username": "admin",
      "role": "administrator"
    }
  }
}
```

#### POST /api/auth/refresh
Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "expiresIn": 86400
  }
}
```

### Swarm Management

#### POST /api/swarms
Create a new swarm with specified topology and configuration.

**Request Body:**
```json
{
  "name": "development-swarm",
  "topology": "hierarchical",
  "maxAgents": 8,
  "strategy": "specialized",
  "configuration": {
    "enableCoordination": true,
    "enableLearning": true,
    "persistenceMode": "auto"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "swarm-1753271039810",
    "name": "development-swarm",
    "topology": "hierarchical",
    "status": "initializing",
    "maxAgents": 8,
    "strategy": "specialized",
    "createdAt": "2025-07-23T11:47:15.205Z"
  }
}
```

#### GET /api/swarms
List all swarms with filtering and pagination.

**Query Parameters:**
- `status`: Filter by status (active, idle, stopped)
- `topology`: Filter by topology type
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "swarms": [
      {
        "id": "swarm-1753271039810",
        "name": "development-swarm",
        "topology": "hierarchical",
        "status": "active",
        "agentCount": 6,
        "taskCount": 12,
        "createdAt": "2025-07-23T11:47:15.205Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### GET /api/swarms/:id/status
Get detailed swarm status and performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "swarm-1753271039810",
    "status": "active",
    "topology": "hierarchical",
    "agents": {
      "total": 6,
      "active": 5,
      "idle": 1,
      "busy": 0
    },
    "tasks": {
      "total": 12,
      "completed": 4,
      "inProgress": 6,
      "pending": 2,
      "failed": 0
    },
    "performance": {
      "averageResponseTime": 1200,
      "throughput": 8.5,
      "successRate": 98.3,
      "memoryUsage": "45.2MB"
    },
    "updatedAt": "2025-07-23T11:47:15.205Z"
  }
}
```

### Agent Management

#### POST /api/agents
Spawn a new agent with specified type and capabilities.

**Request Body:**
```json
{
  "swarmId": "swarm-1753271039810",
  "type": "coder",
  "name": "API Developer",
  "capabilities": [
    "typescript",
    "rest-api",
    "database-design",
    "testing"
  ],
  "configuration": {
    "cognitivePattern": "convergent",
    "learningRate": 0.8,
    "enableMemory": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1753271040142",
    "swarmId": "swarm-1753271039810",
    "type": "coder",
    "name": "API Developer",
    "status": "idle",
    "capabilities": [
      "typescript",
      "rest-api",
      "database-design",
      "testing"
    ],
    "cognitivePattern": "convergent",
    "createdAt": "2025-07-23T11:47:15.205Z"
  }
}
```

#### GET /api/agents
List all agents with filtering options.

**Query Parameters:**
- `swarmId`: Filter by swarm ID
- `type`: Filter by agent type
- `status`: Filter by status
- `capabilities`: Filter by capabilities (comma-separated)

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent-1753271040142",
        "swarmId": "swarm-1753271039810",
        "type": "coder",
        "name": "API Developer",
        "status": "busy",
        "currentTask": "task-1753271050123",
        "capabilities": ["typescript", "rest-api"],
        "performance": {
          "tasksCompleted": 8,
          "averageTime": 1500,
          "successRate": 95.2
        }
      }
    ]
  }
}
```

#### GET /api/agents/:id/metrics
Get detailed agent performance metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "agent-1753271040142",
    "performance": {
      "tasksCompleted": 25,
      "tasksInProgress": 2,
      "tasksFailed": 1,
      "averageTaskTime": 1847,
      "successRate": 96.2,
      "memoryUsage": "12.5MB",
      "cpuUsage": 15.3
    },
    "learning": {
      "pattern": "convergent",
      "learningProgress": 78.5,
      "adaptationScore": 8.2,
      "knowledgeDomains": [
        "typescript",
        "api-development",
        "testing"
      ]
    },
    "activity": {
      "lastActive": "2025-07-23T11:47:15.205Z",
      "uptime": 7200,
      "coordinationEvents": 45
    }
  }
}
```

### Task Orchestration

#### POST /api/tasks/orchestrate
Orchestrate a complex task across multiple agents.

**Request Body:**
```json
{
  "swarmId": "swarm-1753271039810",
  "task": "Build complete REST API with authentication, database, and tests",
  "strategy": "parallel",
  "priority": "high",
  "dependencies": {
    "design": [],
    "implementation": ["design"],
    "testing": ["implementation"],
    "documentation": ["implementation"]
  },
  "maxAgents": 6,
  "timeout": 3600
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1753271050123",
    "swarmId": "swarm-1753271039810",
    "description": "Build complete REST API with authentication, database, and tests",
    "status": "orchestrating",
    "strategy": "parallel",
    "priority": "high",
    "subtasks": [
      {
        "id": "subtask-design",
        "description": "Design API architecture",
        "assignedAgent": "agent-architect",
        "status": "in_progress",
        "estimatedTime": 1800
      },
      {
        "id": "subtask-auth",
        "description": "Implement authentication",
        "assignedAgent": "agent-coder-1",
        "status": "pending",
        "dependencies": ["subtask-design"]
      },
      {
        "id": "subtask-database",
        "description": "Design database schema",
        "assignedAgent": "agent-analyst",
        "status": "in_progress",
        "estimatedTime": 1200
      }
    ],
    "createdAt": "2025-07-23T11:47:15.205Z",
    "estimatedCompletion": "2025-07-23T12:47:15.205Z"
  }
}
```

#### GET /api/tasks/:id/status
Get detailed task status and progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1753271050123",
    "status": "in_progress",
    "progress": {
      "overall": 65,
      "subtasks": {
        "completed": 3,
        "inProgress": 2,
        "pending": 1,
        "total": 6
      }
    },
    "timeline": {
      "started": "2025-07-23T11:47:15.205Z",
      "estimatedCompletion": "2025-07-23T12:47:15.205Z",
      "actualCompletion": null
    },
    "coordination": {
      "agentsInvolved": 4,
      "coordinationEvents": 28,
      "lastCoordination": "2025-07-23T11:55:30.105Z"
    },
    "results": {
      "filesCreated": 12,
      "linesOfCode": 1847,
      "testsWritten": 25,
      "documentationPages": 3
    }
  }
}
```

#### GET /api/tasks/:id/results
Get complete task results and artifacts.

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1753271050123",
    "status": "completed",
    "results": {
      "summary": "Successfully built REST API with authentication, database, and comprehensive tests",
      "artifacts": [
        {
          "type": "file",
          "path": "/api/server.js",
          "description": "Main Express.js server",
          "lines": 156,
          "agent": "agent-coder-1"
        },
        {
          "type": "file",
          "path": "/api/auth/routes.js",
          "description": "Authentication routes",
          "lines": 89,
          "agent": "agent-coder-2"
        },
        {
          "type": "database",
          "schema": "api_schema.sql",
          "tables": 5,
          "agent": "agent-analyst"
        },
        {
          "type": "tests",
          "suite": "api-tests",
          "testCount": 25,
          "coverage": 94.2,
          "agent": "agent-tester"
        }
      ],
      "metrics": {
        "executionTime": 3247,
        "agentsUsed": 4,
        "coordinationEvents": 67,
        "successRate": 100
      },
      "learnings": [
        "Parallel execution improved speed by 2.8x",
        "Hierarchical topology optimal for complex tasks",
        "Agent specialization increased quality by 15%"
      ]
    },
    "completedAt": "2025-07-23T12:31:22.408Z"
  }
}
```

### Memory Management

#### POST /api/memory
Store data in the distributed memory system.

**Request Body:**
```json
{
  "namespace": "swarm-coordination",
  "key": "project-context",
  "value": {
    "projectType": "REST API",
    "technologies": ["nodejs", "typescript", "express"],
    "requirements": ["authentication", "database", "testing"],
    "timeline": "2 hours"
  },
  "ttl": 86400
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "namespace": "swarm-coordination",
    "key": "project-context",
    "stored": true,
    "expiresAt": "2025-07-24T11:47:15.205Z"
  }
}
```

#### GET /api/memory/:namespace
Get all entries in a namespace.

**Query Parameters:**
- `pattern`: Search pattern (optional)
- `limit`: Maximum entries to return

**Response:**
```json
{
  "success": true,
  "data": {
    "namespace": "swarm-coordination",
    "entries": [
      {
        "key": "project-context",
        "value": {
          "projectType": "REST API",
          "technologies": ["nodejs", "typescript"]
        },
        "createdAt": "2025-07-23T11:47:15.205Z",
        "expiresAt": "2025-07-24T11:47:15.205Z"
      }
    ],
    "count": 1
  }
}
```

#### POST /api/memory/search
Search memory entries with advanced filtering.

**Request Body:**
```json
{
  "pattern": "REST API",
  "namespaces": ["swarm-coordination", "agent-knowledge"],
  "limit": 20,
  "includeExpired": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "namespace": "swarm-coordination",
        "key": "project-context",
        "value": { "projectType": "REST API" },
        "relevanceScore": 0.95,
        "createdAt": "2025-07-23T11:47:15.205Z"
      }
    ],
    "totalMatches": 1,
    "searchTime": 23
  }
}
```

### Neural Network Operations

#### GET /api/neural/status
Get neural network system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "active",
    "models": {
      "coordination": {
        "status": "trained",
        "accuracy": 94.2,
        "lastTrained": "2025-07-23T10:30:15.205Z"
      },
      "optimization": {
        "status": "training",
        "progress": 67,
        "eta": 1200
      },
      "prediction": {
        "status": "ready",
        "accuracy": 89.7,
        "predictions": 1247
      }
    },
    "performance": {
      "inferenceTime": 45,
      "memoryUsage": "128MB",
      "cpuUsage": 23.5
    }
  }
}
```

#### POST /api/neural/train
Train neural patterns with provided data.

**Request Body:**
```json
{
  "patternType": "coordination",
  "trainingData": {
    "scenarios": [
      {
        "input": {
          "taskComplexity": "high",
          "agentCount": 6,
          "topology": "hierarchical"
        },
        "output": {
          "success": true,
          "executionTime": 3247,
          "coordination_events": 67
        }
      }
    ]
  },
  "epochs": 50,
  "learningRate": 0.001
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trainingId": "training-1753271055789",
    "patternType": "coordination",
    "status": "started",
    "epochs": 50,
    "estimatedTime": 1800,
    "currentAccuracy": 91.2,
    "targetAccuracy": 95.0
  }
}
```

### System Operations

#### GET /api/system/health
Comprehensive system health check.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-07-23T11:47:15.205Z",
    "uptime": 86400,
    "components": {
      "database": {
        "status": "healthy",
        "connectionPool": 8,
        "responseTime": 12
      },
      "memory": {
        "status": "healthy",
        "usage": "45.2MB",
        "available": "1.2GB"
      },
      "swarms": {
        "status": "healthy",
        "active": 3,
        "total": 5
      },
      "agents": {
        "status": "healthy",
        "active": 15,
        "idle": 3,
        "total": 18
      },
      "tasks": {
        "status": "healthy",
        "running": 8,
        "queued": 2,
        "completed": 156
      }
    },
    "performance": {
      "averageResponseTime": 156,
      "requestsPerSecond": 23.5,
      "errorRate": 0.2
    }
  }
}
```

#### POST /api/system/benchmark
Run system performance benchmarks.

**Request Body:**
```json
{
  "type": "comprehensive",
  "iterations": 10,
  "components": ["swarm", "agent", "task", "memory"],
  "parallel": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "benchmarkId": "bench-1753271060456",
    "status": "running",
    "progress": 0,
    "estimatedTime": 300,
    "components": ["swarm", "agent", "task", "memory"],
    "iterations": 10
  }
}
```

### GitHub Integration

#### POST /api/github/repo/analyze
Analyze GitHub repository with AI swarm.

**Request Body:**
```json
{
  "repository": "owner/repo-name",
  "analysisType": "comprehensive",
  "includeCodeQuality": true,
  "includePerformance": true,
  "includeSecurity": true,
  "swarmConfig": {
    "agents": 5,
    "topology": "mesh"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "analysis-1753271065123",
    "repository": "owner/repo-name",
    "status": "started",
    "swarmId": "swarm-github-analysis",
    "estimatedTime": 1800,
    "agents": [
      {
        "type": "code-reviewer",
        "focus": "code-quality"
      },
      {
        "type": "security-analyst", 
        "focus": "security"
      },
      {
        "type": "performance-tester",
        "focus": "performance"
      }
    ]
  }
}
```

### WebSocket Events

#### Connection: /ws/swarm/:id
Real-time swarm monitoring events.

**Event Types:**
- `swarm.status.changed`: Swarm status updates
- `agent.spawned`: New agent created
- `agent.status.changed`: Agent status updates
- `task.created`: New task created
- `task.completed`: Task completion
- `coordination.event`: Agent coordination events

**Sample Event:**
```json
{
  "event": "task.completed",
  "timestamp": "2025-07-23T11:47:15.205Z",
  "data": {
    "taskId": "task-1753271050123",
    "swarmId": "swarm-1753271039810",
    "agentId": "agent-1753271040142",
    "result": "success",
    "executionTime": 1847,
    "artifacts": ["server.js", "auth.js", "tests.js"]
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `AUTH_INVALID` | Invalid authentication token |
| `AUTH_EXPIRED` | Authentication token expired |
| `VALIDATION_ERROR` | Request validation failed |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `SWARM_LIMIT_EXCEEDED` | Maximum swarm limit reached |
| `AGENT_LIMIT_EXCEEDED` | Maximum agent limit reached |
| `TASK_TIMEOUT` | Task execution timeout |
| `INTERNAL_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### Rate Limiting

- **Authentication endpoints**: 5 requests per minute
- **Swarm operations**: 10 requests per minute
- **Agent operations**: 20 requests per minute
- **Task operations**: 50 requests per minute
- **Memory operations**: 100 requests per minute
- **System operations**: 5 requests per minute