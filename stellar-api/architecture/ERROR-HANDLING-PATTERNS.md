# 🚨 StellarFlow API Error Handling Patterns

## Overview

This document defines comprehensive error handling patterns for the StellarFlow REST API, ensuring consistent, informative, and actionable error responses across all endpoints.

---

## 🎯 Core Principles

1. **Consistency**: All errors follow the same response structure
2. **Clarity**: Error messages are clear and actionable
3. **Context**: Errors include relevant debugging information
4. **Security**: Sensitive information is never exposed
5. **Recovery**: Suggested recovery actions when possible

---

## 📋 Error Response Structure

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}, // Optional: Additional context
    "timestamp": "2025-07-23T12:00:00Z",
    "requestId": "req-abc123",
    "documentation": "https://docs.stellarflow.ai/errors/ERROR_CODE"
  },
  "recovery": { // Optional: Recovery suggestions
    "suggestedAction": "Try this to resolve",
    "retryAfter": 3600,
    "alternativeEndpoint": "/api/v2/alternative"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | ✅ | Always `false` for errors |
| `error.code` | string | ✅ | Machine-readable error code |
| `error.message` | string | ✅ | Human-readable description |
| `error.details` | object/array | ❌ | Additional error context |
| `error.timestamp` | ISO 8601 | ✅ | Error occurrence time |
| `error.requestId` | string | ✅ | Unique request identifier |
| `error.documentation` | URL | ❌ | Link to error documentation |
| `recovery` | object | ❌ | Recovery suggestions |

---

## 🏷️ Error Code Categories

### Naming Convention

```
{CATEGORY}_{SPECIFIC_ERROR}
```

### Categories

| Category | Prefix | HTTP Codes | Description |
|----------|--------|------------|-------------|
| **Authentication** | `AUTH_` | 401, 403 | Authentication/authorization errors |
| **Validation** | `VALIDATION_` | 400, 422 | Input validation errors |
| **Resource** | `RESOURCE_` | 404, 409, 410 | Resource-related errors |
| **Rate Limiting** | `RATE_` | 429 | Rate limit errors |
| **System** | `SYSTEM_` | 500, 503 | System/server errors |
| **Integration** | `INTEGRATION_` | 502, 504 | External service errors |
| **Business Logic** | `BUSINESS_` | 400, 409 | Business rule violations |

---

## 🔐 Authentication Errors

### AUTH_TOKEN_MISSING
**HTTP Status**: 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_MISSING",
    "message": "Authentication token is required",
    "details": {
      "header": "Authorization",
      "format": "Bearer {token}"
    },
    "documentation": "https://docs.stellarflow.ai/auth/tokens"
  }
}
```

### AUTH_TOKEN_INVALID
**HTTP Status**: 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_INVALID",
    "message": "The provided authentication token is invalid",
    "details": {
      "reason": "malformed_token"
    }
  }
}
```

### AUTH_TOKEN_EXPIRED
**HTTP Status**: 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Authentication token has expired",
    "details": {
      "expiredAt": "2025-07-23T11:00:00Z"
    },
    "recovery": {
      "suggestedAction": "Refresh your token using the refresh endpoint",
      "endpoint": "/api/v2/auth/refresh"
    }
  }
}
```

### AUTH_INSUFFICIENT_PERMISSIONS
**HTTP Status**: 403 Forbidden

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to perform this action",
    "details": {
      "required": ["swarms:write"],
      "provided": ["swarms:read"]
    }
  }
}
```

---

## ✅ Validation Errors

### VALIDATION_ERROR
**HTTP Status**: 422 Unprocessable Entity

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
        "value": 150,
        "path": "/data/attributes/maxAgents"
      },
      {
        "field": "data.attributes.name",
        "constraint": "required",
        "message": "Name is required",
        "path": "/data/attributes/name"
      },
      {
        "field": "data.attributes.topology",
        "constraint": "enum",
        "message": "Must be one of: mesh, hierarchical, ring, star",
        "value": "invalid",
        "allowed": ["mesh", "hierarchical", "ring", "star"]
      }
    ]
  }
}
```

### VALIDATION_INVALID_FORMAT
**HTTP Status**: 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_INVALID_FORMAT",
    "message": "Invalid request format",
    "details": {
      "expected": "application/json",
      "received": "text/plain",
      "hint": "Ensure Content-Type header is set to application/json"
    }
  }
}
```

---

## 📦 Resource Errors

### RESOURCE_NOT_FOUND
**HTTP Status**: 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resource": "swarm",
      "id": "sw-nonexistent",
      "searchedIn": "active_swarms"
    }
  }
}
```

### RESOURCE_ALREADY_EXISTS
**HTTP Status**: 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_ALREADY_EXISTS",
    "message": "A resource with this identifier already exists",
    "details": {
      "resource": "agent",
      "field": "name",
      "value": "Coder Prime",
      "existingId": "ag-123"
    },
    "recovery": {
      "suggestedAction": "Use a different name or update the existing resource",
      "existingResource": "/api/v2/agents/ag-123"
    }
  }
}
```

### RESOURCE_GONE
**HTTP Status**: 410 Gone

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_GONE",
    "message": "This resource has been permanently deleted",
    "details": {
      "resource": "task",
      "id": "tk-old123",
      "deletedAt": "2025-07-20T00:00:00Z"
    }
  }
}
```

---

## 🚦 Rate Limiting Errors

### RATE_LIMIT_EXCEEDED
**HTTP Status**: 429 Too Many Requests

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 10000,
      "window": "1h",
      "remaining": 0,
      "resetAt": "2025-07-23T13:00:00Z"
    },
    "recovery": {
      "retryAfter": 3600,
      "suggestedAction": "Implement exponential backoff or upgrade your plan",
      "upgradeUrl": "https://stellarflow.ai/pricing"
    }
  }
}
```

**Headers**:
```http
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1721748000
Retry-After: 3600
```

---

## 💥 System Errors

### SYSTEM_INTERNAL_ERROR
**HTTP Status**: 500 Internal Server Error

```json
{
  "success": false,
  "error": {
    "code": "SYSTEM_INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "errorId": "err-xyz789",
      "timestamp": "2025-07-23T12:00:00Z"
    },
    "recovery": {
      "suggestedAction": "Please try again later. If the problem persists, contact support.",
      "supportUrl": "https://stellarflow.ai/support",
      "statusPage": "https://status.stellarflow.ai"
    }
  }
}
```

### SYSTEM_MAINTENANCE
**HTTP Status**: 503 Service Unavailable

```json
{
  "success": false,
  "error": {
    "code": "SYSTEM_MAINTENANCE",
    "message": "System is under maintenance",
    "details": {
      "scheduledUntil": "2025-07-23T14:00:00Z",
      "affectedServices": ["neural-engine", "github-integration"]
    },
    "recovery": {
      "retryAfter": 7200,
      "alternativeEndpoint": "/api/v2/status",
      "statusPage": "https://status.stellarflow.ai"
    }
  }
}
```

---

## 🔌 Integration Errors

### INTEGRATION_TIMEOUT
**HTTP Status**: 504 Gateway Timeout

```json
{
  "success": false,
  "error": {
    "code": "INTEGRATION_TIMEOUT",
    "message": "External service request timed out",
    "details": {
      "service": "github",
      "operation": "analyze_repository",
      "timeout": 30000
    },
    "recovery": {
      "suggestedAction": "The operation may still complete. Check back later.",
      "statusEndpoint": "/api/v2/operations/op-123"
    }
  }
}
```

### INTEGRATION_SERVICE_ERROR
**HTTP Status**: 502 Bad Gateway

```json
{
  "success": false,
  "error": {
    "code": "INTEGRATION_SERVICE_ERROR",
    "message": "External service returned an error",
    "details": {
      "service": "github",
      "statusCode": 503,
      "message": "GitHub API is temporarily unavailable"
    }
  }
}
```

---

## 💼 Business Logic Errors

### BUSINESS_SWARM_CAPACITY_EXCEEDED
**HTTP Status**: 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_SWARM_CAPACITY_EXCEEDED",
    "message": "Cannot add more agents to this swarm",
    "details": {
      "currentAgents": 8,
      "maxAgents": 8,
      "swarmId": "sw-123"
    },
    "recovery": {
      "suggestedAction": "Increase swarm capacity or create a new swarm",
      "endpoint": "/api/v2/swarms/sw-123",
      "method": "PATCH"
    }
  }
}
```

### BUSINESS_INVALID_STATE_TRANSITION
**HTTP Status**: 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_INVALID_STATE_TRANSITION",
    "message": "Cannot perform this action in the current state",
    "details": {
      "resource": "task",
      "currentState": "completed",
      "attemptedTransition": "start",
      "allowedTransitions": []
    }
  }
}
```

---

## 🛠️ Error Handling Best Practices

### 1. Client-Side Error Handling

```javascript
async function apiCall(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error codes
      switch (data.error?.code) {
        case 'AUTH_TOKEN_EXPIRED':
          await refreshToken();
          return apiCall(endpoint, options); // Retry
          
        case 'RATE_LIMIT_EXCEEDED':
          const retryAfter = data.recovery?.retryAfter || 60;
          await sleep(retryAfter * 1000);
          return apiCall(endpoint, options);
          
        case 'VALIDATION_ERROR':
          handleValidationErrors(data.error.details);
          break;
          
        default:
          console.error('API Error:', data.error);
          showErrorNotification(data.error.message);
      }
      throw new ApiError(data.error);
    }
    
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    // Network or parsing error
    throw new NetworkError('Failed to connect to API');
  }
}
```

### 2. Validation Error Display

```javascript
function handleValidationErrors(errors) {
  errors.forEach(error => {
    const field = document.querySelector(`[name="${error.field}"]`);
    if (field) {
      field.classList.add('error');
      showFieldError(field, error.message);
    }
  });
}
```

### 3. Retry Strategy

```javascript
class RetryableClient {
  constructor(baseURL, maxRetries = 3) {
    this.baseURL = baseURL;
    this.maxRetries = maxRetries;
  }
  
  async request(endpoint, options, retryCount = 0) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, options);
      
      if (response.status === 429 || response.status >= 500) {
        if (retryCount < this.maxRetries) {
          const delay = this.getRetryDelay(retryCount, response);
          await this.sleep(delay);
          return this.request(endpoint, options, retryCount + 1);
        }
      }
      
      return response;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.getRetryDelay(retryCount);
        await this.sleep(delay);
        return this.request(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }
  
  getRetryDelay(retryCount, response) {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, retryCount) * 1000;
    const jitter = Math.random() * 1000;
    
    // Respect Retry-After header if present
    if (response?.headers.has('Retry-After')) {
      const retryAfter = parseInt(response.headers.get('Retry-After'));
      return retryAfter * 1000;
    }
    
    return baseDelay + jitter;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 📊 Error Monitoring

### Metrics to Track

1. **Error Rate by Code**
   ```sql
   SELECT error_code, COUNT(*) as count
   FROM api_errors
   WHERE timestamp > NOW() - INTERVAL '1 hour'
   GROUP BY error_code
   ORDER BY count DESC;
   ```

2. **Error Trends**
   ```sql
   SELECT 
     DATE_TRUNC('hour', timestamp) as hour,
     error_code,
     COUNT(*) as count
   FROM api_errors
   WHERE timestamp > NOW() - INTERVAL '24 hours'
   GROUP BY hour, error_code;
   ```

3. **Client Error Patterns**
   ```sql
   SELECT 
     client_id,
     error_code,
     COUNT(*) as frequency,
     MAX(timestamp) as last_occurrence
   FROM api_errors
   WHERE status_code = 4xx
   GROUP BY client_id, error_code
   HAVING COUNT(*) > 10;
   ```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| 5xx Error Rate | > 1% | > 5% |
| 4xx Error Rate | > 10% | > 25% |
| Specific Error Spike | 10x baseline | 50x baseline |
| Error Response Time | > 1s | > 5s |

---

## 🔍 Debugging Information

### Development Environment

In development, errors include additional debugging information:

```json
{
  "success": false,
  "error": {
    "code": "SYSTEM_INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "stack": "Error: Database connection failed\n    at...",
      "query": "SELECT * FROM swarms WHERE id = ?",
      "params": ["sw-123"],
      "environment": {
        "node": "20.11.0",
        "memory": "234MB/512MB",
        "uptime": 3600
      }
    }
  }
}
```

### Production Environment

In production, sensitive information is filtered:

```json
{
  "success": false,
  "error": {
    "code": "SYSTEM_INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "errorId": "err-abc123",
      "timestamp": "2025-07-23T12:00:00Z"
    }
  }
}
```

---

## 🌐 Localization

Errors support localization via Accept-Language header:

**Request**:
```http
Accept-Language: es-ES
```

**Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La validación de la solicitud falló",
    "details": [
      {
        "field": "name",
        "message": "El nombre es obligatorio"
      }
    ]
  }
}
```

---

## 📝 Error Documentation Template

Each error code should have documentation following this template:

```markdown
## ERROR_CODE_NAME

**HTTP Status**: 4XX/5XX
**Category**: Authentication/Validation/Resource/etc

### Description
Brief description of when this error occurs.

### Common Causes
- Cause 1
- Cause 2

### Example Response
```json
{
  "error": {
    "code": "ERROR_CODE_NAME",
    "message": "..."
  }
}
```

### Resolution Steps
1. Step 1 to resolve
2. Step 2 to resolve

### Prevention
- How to prevent this error
- Best practices
```

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-07-23  
**Author**: System Designer Agent