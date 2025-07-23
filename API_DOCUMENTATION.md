# 📖 StellarFlow API Documentation

<div align="center">

[![API Version](https://img.shields.io/badge/API-v2.0.0--alpha.56-orange?style=for-the-badge)](#)
[![MCP Tools](https://img.shields.io/badge/MCP%20Tools-87-blue?style=for-the-badge)](#)
[![Endpoints](https://img.shields.io/badge/Endpoints-100%2B-green?style=for-the-badge)](#)

*Complete API reference for StellarFlow v2.0.0 Alpha*

</div>

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication & Setup](#authentication--setup)
3. [Core Endpoints](#core-endpoints)
4. [Swarm Orchestration](#swarm-orchestration)
5. [Neural & Cognitive](#neural--cognitive)
6. [Memory Management](#memory-management)
7. [GitHub Integration](#github-integration)
8. [Workflow Automation](#workflow-automation)
9. [Performance & Monitoring](#performance--monitoring)
10. [Error Handling](#error-handling)
11. [Examples & Use Cases](#examples--use-cases)

---

## 🌐 API Overview

### Base URL
```
npx claude-flow@alpha <command> [options]
```

### API Philosophy
StellarFlow API follows RESTful principles with command-line interface:
- **Stateless operations** with persistent memory via SQLite
- **Batch processing** for maximum efficiency
- **Hooks integration** for automated workflows
- **MCP compatibility** for Claude Code integration

### Response Format
```json
{
  "status": "success|error",
  "data": {},
  "message": "Operation completed",
  "timestamp": "2025-07-23T11:49:02.577Z",
  "session_id": "session-xxxxx-xxxxx",
  "memory_key": "namespace/operation/step"
}
```

---

## 🔐 Authentication & Setup

### Initial Setup
```bash
# Prerequisites: Claude Code installation
npm install -g @anthropic-ai/claude-code
claude --dangerously-skip-permissions

# Initialize StellarFlow
npx claude-flow@alpha init --force
```

### MCP Server Configuration
```bash
# Automatic MCP setup (runs during init)
✅ claude-flow MCP server configured
✅ ruv-swarm MCP server configured
✅ 87 tools available in Claude Code
```

### Environment Configuration
```bash
# Environment variables
export CLAUDE_FLOW_HOOKS_ENABLED=true
export CLAUDE_FLOW_TELEMETRY_ENABLED=true
export CLAUDE_FLOW_GITHUB_INTEGRATION=true
```

---

## 🔧 Core Endpoints

### System Information

#### `--version`
Get current version information
```bash
npx claude-flow@alpha --version
# Response: 2.0.0-alpha.56
```

#### `--help`
Get comprehensive help information
```bash
npx claude-flow@alpha --help
npx claude-flow@alpha help <command>  # Command-specific help
```

#### `status`
Get system status and health
```bash
npx claude-flow@alpha status
```

**Response:**
```json
{
  "system": "operational",
  "memory": "8.2MB/11.6MB",
  "active_agents": 0,
  "swarms": 0,
  "hooks": "enabled",
  "mcp_servers": ["claude-flow", "ruv-swarm"]
}
```

### Initialization

#### `init`
Initialize project with StellarFlow
```bash
npx claude-flow@alpha init [options]
```

**Options:**
- `--force`: Force initialization (overwrite existing)
- `--sparc`: Enable SPARC development mode
- `--hive-mind`: Enable hive-mind features
- `--neural-enhanced`: Enable neural networks
- `--project-name <name>`: Set project name

**Example:**
```bash
npx claude-flow@alpha init --force --hive-mind --neural-enhanced
```

---

## 🐝 Swarm Orchestration

### Swarm Management

#### `swarm <objective>`
Create and manage AI swarms
```bash
npx claude-flow@alpha swarm "<objective>" [options]
```

**Options:**
- `--strategy <type>`: Coordination strategy (development, research, analysis, optimization)
- `--agents <count>`: Number of agents (3-12, auto-determined if not specified)
- `--topology <type>`: Network topology (mesh, hierarchical, ring, star)
- `--claude`: Enable Claude Code integration
- `--parallel`: Enable parallel execution
- `--continue-session`: Continue existing session

**Examples:**
```bash
# Simple task coordination
npx claude-flow@alpha swarm "build REST API" --claude

# Complex development project
npx claude-flow@alpha swarm "create microservices architecture" \
  --strategy development \
  --agents 8 \
  --topology hierarchical \
  --claude

# Research coordination
npx claude-flow@alpha swarm "analyze AI safety patterns" \
  --strategy research \
  --neural-patterns enabled
```

#### `swarm monitor`
Real-time swarm monitoring
```bash
npx claude-flow@alpha swarm monitor [options]
```

**Options:**
- `--dashboard`: Enable dashboard view
- `--real-time`: Real-time updates
- `--interval <seconds>`: Update interval

#### `swarm scale`
Scale swarm size
```bash
npx claude-flow@alpha swarm scale --agents <count>
```

### Hive-Mind Operations

#### `hive-mind wizard`
Interactive hive-mind setup
```bash
npx claude-flow@alpha hive-mind wizard
```

#### `hive-mind spawn`
Spawn hive-mind session
```bash
npx claude-flow@alpha hive-mind spawn "<task>" [options]
```

**Options:**
- `--agents <count>`: Number of agents
- `--namespace <name>`: Memory namespace
- `--strategy <type>`: Execution strategy
- `--claude`: Claude Code integration
- `--temp`: Temporary session

**Examples:**
```bash
# Single feature development
npx claude-flow@alpha hive-mind spawn "Implement user authentication" --claude

# Multi-agent research
npx claude-flow@alpha hive-mind spawn "Research microservices patterns" \
  --agents researcher,analyst \
  --claude

# Namespaced development
npx claude-flow@alpha hive-mind spawn "auth-system" \
  --namespace auth \
  --claude
```

#### `hive-mind status`
Get hive-mind status
```bash
npx claude-flow@alpha hive-mind status
```

**Response:**
```json
{
  "status": "active",
  "sessions": [
    {
      "id": "session-xxxxx-xxxxx",
      "task": "Implement user authentication",
      "agents": 6,
      "started": "2025-07-23T10:00:00Z",
      "namespace": "auth"
    }
  ],
  "total_memory": "15.2MB",
  "coordination_points": 42
}
```

#### `hive-mind resume`
Resume previous session
```bash
npx claude-flow@alpha hive-mind resume <session-id>
```

#### `hive-mind sessions`
List all sessions
```bash
npx claude-flow@alpha hive-mind sessions
```

---

## 🧠 Neural & Cognitive

### Neural Network Operations

#### `neural train`
Train neural patterns
```bash
npx claude-flow@alpha neural train [options]
```

**Options:**
- `--pattern <type>`: Pattern type (coordination, optimization, prediction)
- `--epochs <count>`: Training epochs (default: 50)
- `--data <file>`: Training data file
- `--auto-learn`: Enable automatic learning

**Examples:**
```bash
# Train coordination patterns
npx claude-flow@alpha neural train --pattern coordination --epochs 50

# Train with specific data
npx claude-flow@alpha neural train \
  --pattern coordination \
  --data workflow.json \
  --auto-learn
```

#### `neural predict`
Make neural predictions
```bash
npx claude-flow@alpha neural predict --model <model-id> --input <data>
```

**Examples:**
```bash
# Task optimization prediction
npx claude-flow@alpha neural predict \
  --model task-optimizer \
  --input current-state.json

# Cognitive analysis prediction
npx claude-flow@alpha neural predict \
  --model cognitive-analysis \
  --input behavior-data.json
```

#### `neural status`
Get neural network status
```bash
npx claude-flow@alpha neural status [options]
```

**Options:**
- `--model-id <id>`: Specific model ID
- `--detailed`: Detailed metrics

### Cognitive Computing

#### `cognitive analyze`
Analyze cognitive patterns
```bash
npx claude-flow@alpha cognitive analyze --behavior "<pattern>"
```

**Examples:**
```bash
# Development workflow analysis
npx claude-flow@alpha cognitive analyze --behavior "development workflow"

# Pattern recognition analysis
npx claude-flow@alpha cognitive analyze --behavior "coordination patterns"
```

---

## 💾 Memory Management

### Memory Operations

#### `memory store`
Store data in memory
```bash
npx claude-flow@alpha memory store <key> <value> [options]
```

**Options:**
- `--namespace <name>`: Memory namespace (default: "default")
- `--ttl <seconds>`: Time to live
- `--compress`: Enable compression

**Examples:**
```bash
# Basic storage
npx claude-flow@alpha memory store "project-context" "Full-stack app requirements"

# Namespaced storage
npx claude-flow@alpha memory store "auth-config" "JWT settings" --namespace auth

# Temporary storage
npx claude-flow@alpha memory store "temp-data" "session info" --ttl 3600
```

#### `memory query`
Query memory data
```bash
npx claude-flow@alpha memory query <pattern> [options]
```

**Options:**
- `--namespace <name>`: Specific namespace
- `--recent`: Recent entries only
- `--limit <count>`: Limit results (default: 10)
- `--format <type>`: Output format (json, table, summary)

**Examples:**
```bash
# Basic query
npx claude-flow@alpha memory query "authentication"

# Namespaced query
npx claude-flow@alpha memory query "config" --namespace auth

# Recent entries
npx claude-flow@alpha memory query --recent --limit 5
```

#### `memory stats`
Get memory statistics
```bash
npx claude-flow@alpha memory stats
```

**Response:**
```json
{
  "total_entries": 1247,
  "namespaces": 8,
  "size": "15.2MB",
  "tables": {
    "agent_interactions": 324,
    "training_data": 156,
    "performance_metrics": 89,
    "coordination_logs": 234,
    "memory_entries": 444
  },
  "last_cleanup": "2025-07-23T09:30:00Z"
}
```

#### `memory list`
List memory namespaces
```bash
npx claude-flow@alpha memory list
```

#### `memory export`
Export memory data
```bash
npx claude-flow@alpha memory export <filename> [options]
```

**Options:**
- `--namespace <name>`: Specific namespace
- `--format <type>`: Export format (json, csv, sqlite)
- `--compress`: Enable compression

**Examples:**
```bash
# Export all data
npx claude-flow@alpha memory export backup.json

# Export specific namespace
npx claude-flow@alpha memory export auth-backup.json --namespace auth

# Compressed export
npx claude-flow@alpha memory export full-backup.json --compress
```

#### `memory import`
Import memory data
```bash
npx claude-flow@alpha memory import <filename> [options]
```

**Options:**
- `--namespace <name>`: Target namespace
- `--merge`: Merge with existing data
- `--overwrite`: Overwrite existing data

---

## 🐙 GitHub Integration

### GitHub Coordination Modes

#### `github gh-coordinator`
GitHub coordination and analysis
```bash
npx claude-flow@alpha github gh-coordinator <action> [options]
```

**Actions:**
- `analyze`: Repository analysis
- `optimize`: Structure optimization
- `security`: Security analysis

**Options:**
- `--analysis-type <type>`: Analysis type (security, performance, code-quality)
- `--target <path>`: Target directory/file
- `--report`: Generate detailed report

**Examples:**
```bash
# Security analysis
npx claude-flow@alpha github gh-coordinator analyze \
  --analysis-type security \
  --target ./src

# Performance optimization
npx claude-flow@alpha github gh-coordinator optimize \
  --analysis-type performance \
  --report
```

#### `github pr-manager`
Pull request management
```bash
npx claude-flow@alpha github pr-manager <action> [options]
```

**Actions:**
- `review`: Automated code review
- `enhance`: PR enhancement
- `merge`: Intelligent merging

**Options:**
- `--pr <number>`: PR number
- `--multi-reviewer`: Multiple AI reviewers
- `--ai-powered`: Enhanced AI analysis
- `--auto-fix`: Automatic issue fixing

**Examples:**
```bash
# AI-powered review
npx claude-flow@alpha github pr-manager review \
  --pr 123 \
  --multi-reviewer \
  --ai-powered

# PR enhancement
npx claude-flow@alpha github pr-manager enhance \
  --pr 123 \
  --auto-fix
```

#### `github issue-tracker`
Issue tracking and triage
```bash
npx claude-flow@alpha github issue-tracker <action> [options]
```

**Actions:**
- `triage`: Intelligent issue triage
- `assign`: Auto-assign issues
- `prioritize`: Priority analysis

#### `github release-manager`
Release coordination
```bash
npx claude-flow@alpha github release-manager coord --version <version> [options]
```

**Options:**
- `--auto-changelog`: Generate changelog
- `--semantic`: Semantic versioning
- `--notify`: Notification system

#### `github repo-architect`
Repository architecture optimization
```bash
npx claude-flow@alpha github repo-architect optimize [options]
```

**Options:**
- `--structure-analysis`: Analyze structure
- `--security-focused`: Security optimization
- `--compliance <standard>`: Compliance standard (SOC2, GDPR)

#### `github sync-coordinator`
Multi-repository synchronization
```bash
npx claude-flow@alpha github sync-coordinator align --repos <repo-list>
```

---

## 🔄 Workflow Automation

### Workflow Management

#### `workflow create`
Create automated workflows
```bash
npx claude-flow@alpha workflow create --name "<name>" [options]
```

**Options:**
- `--steps <steps>`: Workflow steps (JSON array)
- `--parallel`: Enable parallel execution
- `--triggers <triggers>`: Trigger conditions
- `--dependencies <deps>`: Step dependencies

**Examples:**
```bash
# Development pipeline
npx claude-flow@alpha workflow create \
  --name "CI/CD Pipeline" \
  --steps '["test","build","deploy"]' \
  --parallel

# Custom workflow
npx claude-flow@alpha workflow create \
  --name "Code Review" \
  --steps '["lint","test","review","merge"]'
```

#### `workflow execute`
Execute workflows
```bash
npx claude-flow@alpha workflow execute <workflow-id> [options]
```

**Options:**
- `--params <json>`: Workflow parameters
- `--async`: Asynchronous execution
- `--notify`: Enable notifications

#### `workflow export`
Export workflow definitions
```bash
npx claude-flow@alpha workflow export <workflow-id> [options]
```

**Options:**
- `--format <type>`: Export format (json, yaml, xml)
- `--include-history`: Include execution history

### Batch Processing

#### `batch process`
Batch process operations
```bash
npx claude-flow@alpha batch process --items <items> --operation <op> [options]
```

**Options:**
- `--concurrent`: Concurrent processing
- `--max-workers <count>`: Maximum workers
- `--timeout <seconds>`: Operation timeout

**Examples:**
```bash
# Build pipeline
npx claude-flow@alpha batch process \
  --items "test,build,deploy" \
  --operation "execute" \
  --concurrent

# File processing
npx claude-flow@alpha batch process \
  --items "file1.js,file2.js,file3.js" \
  --operation "format" \
  --max-workers 4
```

#### `parallel execute`
Parallel task execution
```bash
npx claude-flow@alpha parallel execute --tasks <tasks> [options]
```

**Options:**
- `--max-concurrency <count>`: Maximum concurrent tasks
- `--timeout <seconds>`: Task timeout
- `--retry <count>`: Retry attempts

---

## 📊 Performance & Monitoring

### Performance Analysis

#### `performance report`
Generate performance reports
```bash
npx claude-flow@alpha performance report [options]
```

**Options:**
- `--format <type>`: Report format (summary, detailed, json)
- `--timeframe <period>`: Time period (24h, 7d, 30d)
- `--component <name>`: Specific component

**Response Example:**
```json
{
  "timeframe": "24h",
  "summary": {
    "total_operations": 1247,
    "avg_response_time": "52ms",
    "success_rate": "98.2%",
    "memory_usage": "15.2MB",
    "agent_efficiency": "94.7%"
  },
  "metrics": {
    "swarm_init": "5.2ms avg",
    "agent_spawn": "3.4ms avg",
    "neural_processing": "20.2ms avg",
    "memory_operations": "1.8ms avg"
  }
}
```

#### `bottleneck analyze`
Analyze performance bottlenecks
```bash
npx claude-flow@alpha bottleneck analyze [options]
```

**Options:**
- `--component <name>`: Specific component
- `--auto-optimize`: Enable auto-optimization
- `--metrics <list>`: Specific metrics to analyze

#### `token usage`
Analyze token consumption
```bash
npx claude-flow@alpha token usage [options]
```

**Options:**
- `--operation <name>`: Specific operation
- `--timeframe <period>`: Analysis timeframe
- `--breakdown`: Detailed breakdown

### System Monitoring

#### `benchmark run`
Run performance benchmarks
```bash
npx claude-flow@alpha benchmark run [options]
```

**Options:**
- `--suite <name>`: Benchmark suite
- `--iterations <count>`: Number of iterations
- `--compare`: Compare with previous results

#### `health check`
System health monitoring
```bash
npx claude-flow@alpha health check [options]
```

**Options:**
- `--components <list>`: Specific components
- `--deep`: Deep health analysis
- `--auto-heal`: Enable auto-healing

#### `metrics collect`
Collect system metrics
```bash
npx claude-flow@alpha metrics collect [options]
```

**Options:**
- `--components <list>`: Target components
- `--interval <seconds>`: Collection interval
- `--export <filename>`: Export metrics

---

## 🪝 Hooks System

### Hook Operations

#### Pre-Operation Hooks
```bash
# Pre-task hook
npx claude-flow@alpha hooks pre-task \
  --description "Build REST API" \
  --auto-spawn-agents

# Pre-edit hook
npx claude-flow@alpha hooks pre-edit \
  --file "src/api.js" \
  --auto-assign-agents \
  --load-context

# Pre-command hook
npx claude-flow@alpha hooks pre-command \
  --command "npm test" \
  --validate-safety \
  --prepare-resources
```

#### Post-Operation Hooks
```bash
# Post-edit hook
npx claude-flow@alpha hooks post-edit \
  --file "src/api.js" \
  --format \
  --train-neural \
  --update-memory

# Post-command hook
npx claude-flow@alpha hooks post-command \
  --command "build" \
  --track-metrics \
  --store-results

# Post-task hook
npx claude-flow@alpha hooks post-task \
  --task-id "rest-api" \
  --analyze-performance
```

#### Session Hooks
```bash
# Session end hook
npx claude-flow@alpha hooks session-end \
  --generate-summary \
  --persist-state \
  --export-metrics

# Session restore hook
npx claude-flow@alpha hooks session-restore \
  --session-id "session-xxxxx" \
  --load-memory

# Notification hook
npx claude-flow@alpha hooks notify \
  --message "Build completed" \
  --level "success"
```

---

## ❌ Error Handling

### Error Response Format
```json
{
  "status": "error",
  "error": {
    "code": "SWARM_INIT_FAILED",
    "message": "Failed to initialize swarm",
    "details": "Insufficient memory available",
    "timestamp": "2025-07-23T11:49:02.577Z",
    "session_id": "session-xxxxx-xxxxx"
  },
  "recovery": {
    "suggested_action": "Increase memory allocation",
    "retry_possible": true,
    "auto_recovery": false
  }
}
```

### Common Error Codes

| Code | Description | Recovery Action |
|------|-------------|----------------|
| `SWARM_INIT_FAILED` | Swarm initialization failure | Check memory/resources |
| `AGENT_SPAWN_ERROR` | Agent spawning error | Verify agent configuration |
| `MEMORY_FULL` | Memory system full | Clean up old entries |
| `NEURAL_TRAIN_FAILED` | Neural training failure | Check training data |
| `GITHUB_AUTH_ERROR` | GitHub authentication error | Verify credentials |
| `HOOK_EXECUTION_ERROR` | Hook execution failure | Check hook configuration |
| `MCP_CONNECTION_ERROR` | MCP server connection error | Restart MCP servers |

### Error Recovery
```bash
# Automatic recovery
npx claude-flow@alpha recovery --auto

# Manual recovery
npx claude-flow@alpha recovery --point last-safe-state

# Rollback on error
npx claude-flow@alpha init --rollback --security-breach
```

---

## 💡 Examples & Use Cases

### Full-Stack Development
```bash
# Initialize development environment
npx claude-flow@alpha init --force --project-name "ecommerce-app"

# Deploy comprehensive development swarm
npx claude-flow@alpha hive-mind spawn \
  "Build e-commerce platform with React, Node.js, and PostgreSQL" \
  --agents 10 \
  --strategy parallel \
  --namespace ecommerce \
  --claude

# Monitor progress
npx claude-flow@alpha swarm monitor --dashboard --real-time

# Store development context
npx claude-flow@alpha memory store \
  "architecture" \
  "Microservices with API Gateway" \
  --namespace ecommerce
```

### Research & Analysis
```bash
# Research coordination
npx claude-flow@alpha swarm \
  "Research AI safety in autonomous systems" \
  --strategy research \
  --neural-patterns enabled \
  --claude

# Analyze results
npx claude-flow@alpha cognitive analyze --target research-results

# Export findings
npx claude-flow@alpha memory export research-findings.json --namespace research
```

### Security & Compliance
```bash
# Security analysis
npx claude-flow@alpha github gh-coordinator analyze \
  --analysis-type security \
  --target ./src

# Compliance optimization
npx claude-flow@alpha github repo-architect optimize \
  --security-focused \
  --compliance SOC2

# Security audit
npx claude-flow@alpha hive-mind spawn \
  "security audit and compliance review" \
  --claude
```

### Performance Optimization
```bash
# Performance analysis
npx claude-flow@alpha bottleneck analyze --auto-optimize

# Benchmark comparison
npx claude-flow@alpha benchmark run --compare

# Neural optimization
npx claude-flow@alpha neural train \
  --pattern optimization \
  --auto-learn
```

---

## 🔗 Integration Examples

### Claude Code Integration
```javascript
// In Claude Code, use MCP tools:

// Initialize swarm coordination
mcp__claude_flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 8,
  strategy: "development"
})

// Spawn specialized agents
mcp__claude_flow__agent_spawn({
  type: "architect",
  name: "System Designer"
})

// Store coordination context
mcp__claude_flow__memory_usage({
  action: "store",
  key: "project/architecture",
  value: "Microservices design patterns"
})
```

### API Integration
```bash
# Batch operations
npx claude-flow@alpha batch process \
  --items "analyze,design,implement,test,deploy" \
  --operation "execute" \
  --concurrent

# Workflow automation
npx claude-flow@alpha workflow create \
  --name "Development Pipeline" \
  --steps '["lint","test","build","deploy"]' \
  --triggers '["push","pr"]'
```

---

## 📚 Additional Resources

- **[Project README](./PROJECT_README.md)**: Complete project overview
- **[Development Guidelines](./DEVELOPMENT_GUIDELINES.md)**: Coding standards and practices
- **[Deployment Guide](./DEPLOYMENT_INSTRUCTIONS.md)**: Production deployment
- **[Examples Directory](./examples/)**: Working code examples
- **[Troubleshooting](./docs/troubleshooting.md)**: Common issues and solutions

---

<div align="center">

**🚀 API Documentation Complete**

*For the latest updates and features, visit our [GitHub repository](https://github.com/ruvnet/claude-flow)*

**Built with ❤️ by [rUv](https://github.com/ruvnet) | Powered by Revolutionary AI**

</div>