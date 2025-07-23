# 📡 StellarFlow API Endpoints Specification

## Overview

This document provides detailed specifications for all REST API endpoints in the StellarFlow system, including request/response schemas, examples, and error scenarios.

---

## 🔐 Authentication Endpoints

### POST /api/v2/auth/register
Create a new user account.

**Request Body:**
```json
{
  "username": "developer123",
  "email": "dev@example.com",
  "password": "SecureP@ssw0rd!",
  "fullName": "John Developer"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "usr-abc123",
    "username": "developer123",
    "email": "dev@example.com",
    "fullName": "John Developer",
    "role": "developer",
    "createdAt": "2025-07-23T12:00:00Z"
  },
  "meta": {
    "timestamp": "2025-07-23T12:00:00Z"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_USER_EXISTS",
    "message": "Username already exists",
    "field": "username"
  }
}
```

---

### POST /api/v2/auth/login
Authenticate and receive tokens.

**Request Body:**
```json
{
  "username": "developer123",
  "password": "SecureP@ssw0rd!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 604800,
    "user": {
      "id": "usr-abc123",
      "username": "developer123",
      "role": "developer",
      "permissions": ["swarms:manage", "agents:create", "tasks:execute"]
    }
  }
}
```

---

### POST /api/v2/auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 604800
  }
}
```

---

### POST /api/v2/auth/logout
Invalidate current session.

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**Response (204 No Content):**
```
(empty body)
```

---

## 🐝 Swarm Management Endpoints

### GET /api/v2/swarms
List all swarms with filtering and pagination.

**Query Parameters:**
- `page[number]` - Page number (default: 1)
- `page[size]` - Items per page (default: 20, max: 100)
- `filter[status]` - Filter by status (active, paused, terminated)
- `filter[topology]` - Filter by topology
- `sort` - Sort order (e.g., -createdAt, name)
- `include` - Include related resources (agents, tasks)

**Request:**
```
GET /api/v2/swarms?filter[status]=active&include=agents&page[size]=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sw-123",
      "type": "swarm",
      "attributes": {
        "name": "Development Swarm",
        "topology": "hierarchical",
        "status": "active",
        "maxAgents": 8,
        "strategy": "specialized",
        "createdAt": "2025-07-23T10:00:00Z",
        "updatedAt": "2025-07-23T11:00:00Z"
      },
      "relationships": {
        "agents": {
          "data": [
            { "type": "agent", "id": "ag-456" },
            { "type": "agent", "id": "ag-789" }
          ]
        }
      }
    }
  ],
  "included": [
    {
      "id": "ag-456",
      "type": "agent",
      "attributes": {
        "name": "Researcher Alpha",
        "type": "researcher",
        "status": "active"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "pageCount": 3,
      "totalCount": 28
    }
  },
  "links": {
    "self": "/api/v2/swarms?filter[status]=active&page[number]=1",
    "next": "/api/v2/swarms?filter[status]=active&page[number]=2",
    "last": "/api/v2/swarms?filter[status]=active&page[number]=3"
  }
}
```

---

### POST /api/v2/swarms
Create a new swarm.

**Request Body:**
```json
{
  "data": {
    "type": "swarm",
    "attributes": {
      "name": "AI Research Swarm",
      "topology": "mesh",
      "maxAgents": 12,
      "strategy": "adaptive",
      "configuration": {
        "enableCoordination": true,
        "enableLearning": true,
        "persistenceMode": "auto",
        "coordinationProtocol": "consensus"
      }
    }
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "sw-new123",
    "type": "swarm",
    "attributes": {
      "name": "AI Research Swarm",
      "topology": "mesh",
      "status": "initializing",
      "maxAgents": 12,
      "strategy": "adaptive",
      "createdAt": "2025-07-23T12:00:00Z",
      "updatedAt": "2025-07-23T12:00:00Z"
    },
    "links": {
      "self": "/api/v2/swarms/sw-new123"
    }
  },
  "meta": {
    "location": "/api/v2/swarms/sw-new123"
  }
}
```

---

### GET /api/v2/swarms/{swarmId}
Get detailed swarm information.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "sw-123",
    "type": "swarm",
    "attributes": {
      "name": "Development Swarm",
      "topology": "hierarchical",
      "status": "active",
      "maxAgents": 8,
      "activeAgents": 6,
      "strategy": "specialized",
      "metrics": {
        "tasksCompleted": 156,
        "avgCompletionTime": 2340,
        "successRate": 0.94
      },
      "createdAt": "2025-07-23T10:00:00Z",
      "updatedAt": "2025-07-23T11:00:00Z"
    },
    "relationships": {
      "agents": {
        "links": {
          "self": "/api/v2/swarms/sw-123/relationships/agents",
          "related": "/api/v2/swarms/sw-123/agents"
        },
        "meta": {
          "count": 6
        }
      },
      "tasks": {
        "links": {
          "self": "/api/v2/swarms/sw-123/relationships/tasks",
          "related": "/api/v2/swarms/sw-123/tasks"
        },
        "meta": {
          "count": 23
        }
      }
    }
  }
}
```

---

### PATCH /api/v2/swarms/{swarmId}
Update swarm configuration.

**Request Body:**
```json
{
  "data": {
    "type": "swarm",
    "id": "sw-123",
    "attributes": {
      "maxAgents": 10,
      "strategy": "balanced"
    }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "sw-123",
    "type": "swarm",
    "attributes": {
      "name": "Development Swarm",
      "topology": "hierarchical",
      "status": "active",
      "maxAgents": 10,
      "strategy": "balanced",
      "updatedAt": "2025-07-23T12:30:00Z"
    }
  }
}
```

---

### POST /api/v2/swarms/{swarmId}/start
Start or resume swarm operations.

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "message": "Swarm starting",
    "operationId": "op-789",
    "estimatedTime": 5000
  },
  "links": {
    "status": "/api/v2/operations/op-789"
  }
}
```

---

### POST /api/v2/swarms/{swarmId}/stop
Pause swarm operations.

**Request Body (optional):**
```json
{
  "graceful": true,
  "timeout": 30000
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "message": "Swarm stopping gracefully",
    "operationId": "op-790"
  }
}
```

---

### DELETE /api/v2/swarms/{swarmId}
Terminate and remove swarm.

**Query Parameters:**
- `force` - Force deletion even with active tasks (default: false)

**Response (204 No Content):**
```
(empty body)
```

---

## 🤖 Agent Management Endpoints

### GET /api/v2/agents
List all agents across swarms.

**Query Parameters:**
- `filter[swarmId]` - Filter by swarm
- `filter[type]` - Filter by agent type
- `filter[status]` - Filter by status
- `sort` - Sort order

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ag-456",
      "type": "agent",
      "attributes": {
        "name": "Coder Prime",
        "agentType": "coder",
        "status": "active",
        "capabilities": ["javascript", "python", "api-design"],
        "metrics": {
          "tasksCompleted": 45,
          "avgResponseTime": 1250,
          "successRate": 0.96
        },
        "createdAt": "2025-07-23T10:15:00Z"
      },
      "relationships": {
        "swarm": {
          "data": { "type": "swarm", "id": "sw-123" }
        },
        "currentTask": {
          "data": { "type": "task", "id": "tk-current" }
        }
      }
    }
  ],
  "meta": {
    "totalCount": 42
  }
}
```

---

### POST /api/v2/agents
Spawn a new agent.

**Request Body:**
```json
{
  "data": {
    "type": "agent",
    "attributes": {
      "name": "Security Analyzer",
      "agentType": "analyst",
      "capabilities": ["security-audit", "vulnerability-scan", "compliance"],
      "configuration": {
        "autoAssign": true,
        "priority": "high",
        "cognitivePattern": "critical"
      }
    },
    "relationships": {
      "swarm": {
        "data": { "type": "swarm", "id": "sw-123" }
      }
    }
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "ag-new567",
    "type": "agent",
    "attributes": {
      "name": "Security Analyzer",
      "agentType": "analyst",
      "status": "initializing",
      "capabilities": ["security-audit", "vulnerability-scan", "compliance"],
      "createdAt": "2025-07-23T12:00:00Z"
    }
  }
}
```

---

### GET /api/v2/agents/{agentId}/metrics
Get detailed agent performance metrics.

**Query Parameters:**
- `timeframe` - Time period (1h, 24h, 7d, 30d)
- `metrics` - Specific metrics to include

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "agentId": "ag-456",
    "timeframe": "24h",
    "metrics": {
      "performance": {
        "tasksCompleted": 23,
        "tasksFaild": 1,
        "avgCompletionTime": 2150,
        "successRate": 0.958
      },
      "resource": {
        "cpuUsage": 0.45,
        "memoryUsage": 0.32,
        "activeTime": 18234
      },
      "coordination": {
        "messagessSent": 156,
        "messagesReceived": 203,
        "coordinationScore": 0.89
      }
    },
    "timeline": [
      {
        "timestamp": "2025-07-23T11:00:00Z",
        "tasksCompleted": 3,
        "avgResponseTime": 1890
      }
    ]
  }
}
```

---

## 📋 Task Management Endpoints

### POST /api/v2/tasks
Create a new task.

**Request Body:**
```json
{
  "data": {
    "type": "task",
    "attributes": {
      "description": "Implement user authentication with JWT",
      "priority": "high",
      "requirements": {
        "language": "typescript",
        "framework": "express",
        "features": ["login", "refresh-token", "logout", "password-reset"]
      },
      "deadline": "2025-07-25T00:00:00Z"
    },
    "relationships": {
      "swarm": {
        "data": { "type": "swarm", "id": "sw-123" }
      }
    }
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "tk-new999",
    "type": "task",
    "attributes": {
      "description": "Implement user authentication with JWT",
      "status": "pending",
      "priority": "high",
      "estimatedTime": 7200,
      "createdAt": "2025-07-23T12:00:00Z"
    },
    "relationships": {
      "swarm": {
        "data": { "type": "swarm", "id": "sw-123" }
      },
      "assignedAgent": {
        "data": null
      }
    }
  }
}
```

---

### POST /api/v2/tasks/orchestrate
Orchestrate complex multi-agent task.

**Request Body:**
```json
{
  "task": "Build complete e-commerce REST API with authentication, product catalog, and order management",
  "strategy": "parallel",
  "requirements": {
    "phases": [
      {
        "name": "architecture",
        "agents": ["architect", "analyst"],
        "duration": 3600
      },
      {
        "name": "implementation",
        "agents": ["coder", "coder", "tester"],
        "duration": 14400
      },
      {
        "name": "deployment",
        "agents": ["devops", "tester"],
        "duration": 7200
      }
    ],
    "constraints": {
      "maxDuration": 28800,
      "requiredCapabilities": ["api-design", "nodejs", "testing"]
    }
  },
  "swarmId": "sw-123"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "orchestrationId": "orch-complex123",
    "status": "planning",
    "phases": [
      {
        "phaseId": "ph-1",
        "name": "architecture",
        "status": "pending",
        "assignedAgents": []
      }
    ],
    "estimatedCompletion": "2025-07-23T20:00:00Z"
  },
  "links": {
    "status": "/api/v2/orchestrations/orch-complex123",
    "websocket": "wss://api.stellarflow.ai/v2/ws/orchestrations/orch-complex123"
  }
}
```

---

### GET /api/v2/tasks/{taskId}/results
Get task execution results.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "taskId": "tk-999",
    "status": "completed",
    "completedAt": "2025-07-23T14:30:00Z",
    "executionTime": 7245,
    "result": {
      "filesCreated": [
        "src/auth/jwt.service.ts",
        "src/auth/auth.controller.ts",
        "src/auth/auth.module.ts"
      ],
      "testsWritten": 12,
      "testsPassed": 12,
      "coverage": 0.94,
      "documentation": "README.md updated with authentication guide",
      "artifacts": {
        "postmanCollection": "/api/v2/artifacts/art-123",
        "swaggerSpec": "/api/v2/artifacts/art-124"
      }
    },
    "agent": {
      "id": "ag-456",
      "name": "Coder Prime",
      "performance": {
        "efficiency": 0.92,
        "quality": 0.95
      }
    }
  }
}
```

---

## 💾 Memory Management Endpoints

### POST /api/v2/memory
Store data in memory system.

**Request Body:**
```json
{
  "namespace": "project-alpha",
  "key": "architecture-decisions",
  "value": {
    "database": "PostgreSQL",
    "cache": "Redis",
    "queue": "RabbitMQ",
    "decided": "2025-07-23T10:00:00Z",
    "rationale": "Scalability and reliability requirements"
  },
  "ttl": 2592000,
  "tags": ["architecture", "decisions", "backend"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "mem-stored123",
    "namespace": "project-alpha",
    "key": "architecture-decisions",
    "size": 256,
    "expiresAt": "2025-08-22T12:00:00Z",
    "createdAt": "2025-07-23T12:00:00Z"
  }
}
```

---

### GET /api/v2/memory/search
Search memory entries.

**Query Parameters:**
- `q` - Search query
- `namespace` - Filter by namespace
- `tags` - Filter by tags (comma-separated)
- `before` - Created before date
- `after` - Created after date

**Request:**
```
GET /api/v2/memory/search?q=architecture&namespace=project-alpha&tags=decisions
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "mem-123",
      "namespace": "project-alpha",
      "key": "architecture-decisions",
      "preview": "database: PostgreSQL, cache: Redis...",
      "size": 256,
      "tags": ["architecture", "decisions", "backend"],
      "createdAt": "2025-07-23T10:00:00Z",
      "accessCount": 15,
      "lastAccessed": "2025-07-23T11:45:00Z"
    }
  ],
  "meta": {
    "totalResults": 3,
    "searchTime": 12
  }
}
```

---

## 🧠 Neural Network Endpoints

### POST /api/v2/neural/train
Train neural patterns.

**Request Body:**
```json
{
  "patternType": "coordination",
  "trainingData": {
    "samples": [
      {
        "input": {
          "taskComplexity": 0.8,
          "agentCount": 5,
          "topology": "hierarchical"
        },
        "output": {
          "optimalStrategy": "specialized",
          "expectedTime": 3600
        }
      }
    ],
    "validationSplit": 0.2
  },
  "configuration": {
    "epochs": 100,
    "learningRate": 0.001,
    "batchSize": 32
  }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "trainingId": "train-neural123",
    "status": "training",
    "estimatedTime": 300,
    "currentEpoch": 0,
    "totalEpochs": 100
  },
  "links": {
    "status": "/api/v2/neural/training/train-neural123",
    "websocket": "wss://api.stellarflow.ai/v2/ws/training/train-neural123"
  }
}
```

---

### POST /api/v2/neural/predict
Make neural predictions.

**Request Body:**
```json
{
  "modelId": "model-coordination-v2",
  "input": {
    "taskDescription": "Build microservices architecture",
    "constraints": {
      "timeLimit": 28800,
      "requiredQuality": 0.95
    },
    "availableAgents": 8
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "prediction": {
      "recommendedTopology": "hierarchical",
      "optimalAgentCount": 6,
      "strategy": "specialized",
      "estimatedTime": 21600,
      "confidenceScore": 0.89,
      "reasoning": [
        "Complex architecture requires specialized agents",
        "Hierarchical topology suits multi-component systems",
        "6 agents optimal for parallel work without overhead"
      ]
    },
    "modelInfo": {
      "modelId": "model-coordination-v2",
      "version": "2.1.0",
      "lastTrainined": "2025-07-20T00:00:00Z",
      "accuracy": 0.92
    }
  }
}
```

---

## 🐙 GitHub Integration Endpoints

### POST /api/v2/github/repos/analyze
Analyze GitHub repository.

**Request Body:**
```json
{
  "repository": "stellarflow/api-project",
  "analysisType": ["code-quality", "security", "performance"],
  "branch": "main",
  "depth": "full"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "analysisId": "gh-analysis-456",
    "repository": "stellarflow/api-project",
    "status": "analyzing",
    "phases": [
      {
        "name": "code-quality",
        "status": "in-progress",
        "progress": 0.15
      },
      {
        "name": "security",
        "status": "pending"
      },
      {
        "name": "performance",
        "status": "pending"
      }
    ]
  },
  "links": {
    "results": "/api/v2/github/analysis/gh-analysis-456"
  }
}
```

---

### POST /api/v2/github/pr/{prNumber}/enhance
Enhance pull request with AI.

**Request Body:**
```json
{
  "repository": "stellarflow/api-project",
  "enhancements": {
    "improveDescription": true,
    "addTests": true,
    "updateDocumentation": true,
    "performanceOptimization": true,
    "securityReview": true
  },
  "autoCommit": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "prNumber": 123,
    "enhancements": {
      "description": {
        "improved": true,
        "changes": "Added detailed implementation notes and impact analysis"
      },
      "tests": {
        "added": 5,
        "coverage": "increased from 78% to 91%"
      },
      "documentation": {
        "files": ["README.md", "API.md"],
        "sections": ["Authentication", "Error Handling"]
      },
      "optimization": {
        "improvements": 3,
        "estimatedGain": "23% faster response time"
      },
      "security": {
        "issues": 0,
        "recommendations": 2
      }
    },
    "preview": {
      "branch": "pr-123-enhanced",
      "compareUrl": "https://github.com/stellarflow/api-project/compare/pr-123...pr-123-enhanced"
    }
  }
}
```

---

## 🔄 Workflow Automation Endpoints

### POST /api/v2/workflows
Create custom workflow.

**Request Body:**
```json
{
  "name": "CI/CD Pipeline",
  "description": "Automated testing and deployment workflow",
  "triggers": [
    {
      "type": "github",
      "event": "push",
      "branches": ["main", "develop"]
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "name": "Run Tests",
      "action": "execute-command",
      "parameters": {
        "command": "npm test",
        "timeout": 300000
      }
    },
    {
      "id": "step-2",
      "name": "Build Application",
      "action": "execute-command",
      "parameters": {
        "command": "npm run build"
      },
      "dependsOn": ["step-1"]
    },
    {
      "id": "step-3",
      "name": "Deploy to Staging",
      "action": "deploy",
      "parameters": {
        "environment": "staging",
        "strategy": "blue-green"
      },
      "dependsOn": ["step-2"]
    }
  ],
  "notifications": {
    "channels": ["email", "slack"],
    "events": ["started", "failed", "completed"]
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "wf-cicd123",
    "name": "CI/CD Pipeline",
    "status": "active",
    "version": 1,
    "createdAt": "2025-07-23T12:00:00Z",
    "nextRun": null,
    "stats": {
      "totalRuns": 0,
      "successRate": null,
      "avgDuration": null
    }
  }
}
```

---

## 📊 System & Monitoring Endpoints

### GET /api/v2/system/health
Comprehensive health check.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-07-23T12:00:00Z",
    "version": "2.0.0",
    "uptime": 8640000,
    "components": {
      "api": {
        "status": "healthy",
        "responseTime": 12
      },
      "database": {
        "status": "healthy",
        "connections": 5,
        "responseTime": 3
      },
      "cache": {
        "status": "healthy",
        "hitRate": 0.89,
        "memoryUsage": 0.34
      },
      "swarmCoordinator": {
        "status": "healthy",
        "activeSwarms": 12,
        "activeAgents": 67
      },
      "neuralEngine": {
        "status": "healthy",
        "modelsLoaded": 5,
        "inferenceTime": 45
      }
    }
  }
}
```

---

### GET /api/v2/metrics
System-wide metrics.

**Query Parameters:**
- `period` - Time period (1h, 24h, 7d)
- `metrics` - Specific metrics to include
- `resolution` - Data point resolution

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "metrics": {
      "requests": {
        "total": 156234,
        "successful": 154890,
        "failed": 1344,
        "rate": 1.81
      },
      "performance": {
        "avgResponseTime": 67,
        "p50": 45,
        "p90": 123,
        "p95": 189,
        "p99": 423
      },
      "resources": {
        "cpu": 0.34,
        "memory": 0.56,
        "diskIO": 0.23,
        "networkIO": 0.45
      },
      "business": {
        "swarmsCreated": 23,
        "tasksCompleted": 1567,
        "agentsSpawned": 134,
        "avgTaskTime": 3421
      }
    }
  }
}
```

---

## 🌐 WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.stellarflow.ai/v2/ws/swarms/sw-123');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'Bearer eyJhbGciOiJSUzI1NiIs...'
  }));
});
```

### Event Examples

**Swarm Status Update:**
```json
{
  "type": "swarm.status.changed",
  "timestamp": "2025-07-23T12:00:00Z",
  "data": {
    "swarmId": "sw-123",
    "previousStatus": "initializing",
    "currentStatus": "active",
    "agents": 6
  }
}
```

**Agent Task Assignment:**
```json
{
  "type": "agent.task.assigned",
  "timestamp": "2025-07-23T12:00:01Z",
  "data": {
    "agentId": "ag-456",
    "taskId": "tk-789",
    "taskDescription": "Implement user service",
    "estimatedTime": 3600
  }
}
```

**Task Progress Update:**
```json
{
  "type": "task.progress",
  "timestamp": "2025-07-23T12:15:00Z",
  "data": {
    "taskId": "tk-789",
    "progress": 0.45,
    "currentPhase": "implementation",
    "message": "Creating service layer..."
  }
}
```

---

## 🔒 Security Headers

All API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Request-ID: req-abc123def456
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9995
```

---

## 📚 Error Response Catalog

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "data.attributes.maxAgents",
        "constraint": "max",
        "message": "Must not exceed 100",
        "value": 150
      },
      {
        "field": "data.attributes.name",
        "constraint": "required",
        "message": "Name is required"
      }
    ]
  }
}
```

### Rate Limit Error
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "retryAfter": 3600,
    "limit": 10000,
    "window": "1h",
    "upgradeUrl": "https://stellarflow.ai/pricing"
  }
}
```

### Resource Not Found
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Swarm not found",
    "resource": "swarm",
    "id": "sw-nonexistent"
  }
}
```

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-07-23  
**API Version**: 2.0.0