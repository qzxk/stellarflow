/**
 * Query Optimizer Utilities
 * Provides query analysis, optimization suggestions, and performance monitoring
 */

class QueryOptimizer {
  constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 100; // milliseconds
    this.enableLogging = process.env.ENABLE_QUERY_LOGGING === 'true';
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQuery(database, sql, params = []) {
    const startTime = Date.now();
    let result;
    let error = null;

    try {
      // Execute EXPLAIN QUERY PLAN
      const queryPlan = await database.allAsync(`EXPLAIN QUERY PLAN ${sql}`, params);
      
      // Execute the actual query
      result = await database.allAsync(sql, params);
      
      const executionTime = Date.now() - startTime;
      
      // Store query statistics
      this.recordQueryStats(sql, executionTime, params);
      
      // Analyze and suggest optimizations
      const analysis = this.performQueryAnalysis(sql, queryPlan, executionTime);
      
      if (this.enableLogging) {
        console.log('Query Analysis:', {
          sql: sql.substring(0, 100) + '...',
          executionTime,
          suggestions: analysis.suggestions
        });
      }
      
      return {
        result,
        analysis,
        executionTime,
        queryPlan
      };
    } catch (err) {
      error = err;
      throw err;
    } finally {
      // Log slow queries
      const executionTime = Date.now() - startTime;
      if (executionTime > this.slowQueryThreshold) {
        console.warn('Slow Query Detected:', {
          sql: sql.substring(0, 200),
          executionTime,
          params: params.length,
          error: error?.message
        });
      }
    }
  }

  /**
   * Record query statistics for performance monitoring
   */
  recordQueryStats(sql, executionTime, params) {
    // Normalize SQL for statistics (remove parameter values)
    const normalizedSql = this.normalizeSql(sql);
    
    if (!this.queryStats.has(normalizedSql)) {
      this.queryStats.set(normalizedSql, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        lastExecuted: null
      });
    }
    
    const stats = this.queryStats.get(normalizedSql);
    stats.count++;
    stats.totalTime += executionTime;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.avgTime = stats.totalTime / stats.count;
    stats.lastExecuted = new Date();
  }

  /**
   * Normalize SQL query for statistics tracking
   */
  normalizeSql(sql) {
    return sql
      .replace(/\$\d+/g, '?')  // Replace $1, $2, etc. with ?
      .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
      .trim()
      .toLowerCase();
  }

  /**
   * Perform query analysis and generate optimization suggestions
   */
  performQueryAnalysis(sql, queryPlan, executionTime) {
    const suggestions = [];
    const warnings = [];
    let score = 100; // Start with perfect score

    // Analyze query plan
    for (const step of queryPlan) {
      // Check for table scans
      if (step.detail && step.detail.includes('SCAN TABLE')) {
        suggestions.push({
          type: 'INDEX',
          severity: 'HIGH',
          message: `Consider adding an index for table scan: ${step.detail}`,
          table: this.extractTableName(step.detail),
          recommendation: 'Add appropriate index to avoid table scan'
        });
        score -= 20;
      }

      // Check for missing indexes
      if (step.detail && step.detail.includes('USING INTEGER PRIMARY KEY')) {
        // This is good - using primary key index
      } else if (step.detail && !step.detail.includes('USING INDEX')) {
        warnings.push({
          type: 'PERFORMANCE',
          message: 'Query step not using index',
          detail: step.detail
        });
        score -= 10;
      }

      // Check for temporary B-tree usage
      if (step.detail && step.detail.includes('USE TEMP B-TREE')) {
        suggestions.push({
          type: 'SORT_OPTIMIZATION',
          severity: 'MEDIUM',
          message: 'Query requires temporary B-tree for sorting',
          recommendation: 'Consider adding index on ORDER BY columns'
        });
        score -= 15;
      }
    }

    // Analyze SQL structure
    const sqlLower = sql.toLowerCase();

    // Check for SELECT *
    if (sqlLower.includes('select *')) {
      suggestions.push({
        type: 'COLUMN_SELECTION',
        severity: 'MEDIUM',
        message: 'Avoid SELECT * - specify only needed columns',
        recommendation: 'List specific columns to reduce data transfer and memory usage'
      });
      score -= 10;
    }

    // Check for LIKE with leading wildcard
    if (sqlLower.includes('like \'%')) {
      suggestions.push({
        type: 'SEARCH_OPTIMIZATION',
        severity: 'HIGH',
        message: 'LIKE with leading wildcard prevents index usage',
        recommendation: 'Consider full-text search or restructure query'
      });
      score -= 25;
    }

    // Check for OR conditions
    if (sqlLower.includes(' or ')) {
      suggestions.push({
        type: 'LOGIC_OPTIMIZATION',
        severity: 'MEDIUM',
        message: 'OR conditions can prevent index usage',
        recommendation: 'Consider using UNION or separate queries with indexes'
      });
      score -= 10;
    }

    // Check for subqueries in WHERE clause
    if (sqlLower.includes('where') && sqlLower.includes('select')) {
      const whereIndex = sqlLower.indexOf('where');
      const fromIndex = sqlLower.indexOf('from');
      if (whereIndex > fromIndex && sqlLower.substring(whereIndex).includes('select')) {
        suggestions.push({
          type: 'SUBQUERY_OPTIMIZATION',
          severity: 'MEDIUM',
          message: 'Subquery in WHERE clause detected',
          recommendation: 'Consider using JOINs instead of subqueries for better performance'
        });
        score -= 15;
      }
    }

    // Performance score based on execution time
    if (executionTime > 1000) {
      score -= 30;
      warnings.push({
        type: 'SLOW_QUERY',
        message: `Query execution time (${executionTime}ms) exceeds recommended threshold`,
        recommendation: 'Investigate query optimization opportunities'
      });
    } else if (executionTime > this.slowQueryThreshold) {
      score -= 10;
    }

    return {
      score: Math.max(0, score),
      executionTime,
      suggestions,
      warnings,
      queryComplexity: this.calculateQueryComplexity(sql),
      recommendedIndexes: this.suggestIndexes(sql, queryPlan)
    };
  }

  /**
   * Extract table name from query plan detail
   */
  extractTableName(detail) {
    const match = detail.match(/(?:SCAN|SEARCH) TABLE (\w+)/i);
    return match ? match[1] : null;
  }

  /**
   * Calculate query complexity score
   */
  calculateQueryComplexity(sql) {
    const sqlLower = sql.toLowerCase();
    let complexity = 1;

    // Count JOINs
    const joinCount = (sqlLower.match(/\bjoin\b/g) || []).length;
    complexity += joinCount * 2;

    // Count subqueries
    const subqueryCount = (sqlLower.match(/\(select\b/g) || []).length;
    complexity += subqueryCount * 3;

    // Count aggregation functions
    const aggFunctions = ['count', 'sum', 'avg', 'max', 'min', 'group_concat'];
    aggFunctions.forEach(func => {
      const count = (sqlLower.match(new RegExp(`\\b${func}\\b`, 'g')) || []).length;
      complexity += count;
    });

    // Count UNION operations
    const unionCount = (sqlLower.match(/\bunion\b/g) || []).length;
    complexity += unionCount * 2;

    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Suggest indexes based on query analysis
   */
  suggestIndexes(sql, queryPlan) {
    const suggestions = [];
    const sqlLower = sql.toLowerCase();

    // Extract WHERE clause conditions
    const whereMatch = sqlLower.match(/where\s+(.+?)(?:\s+(?:group|order|limit|$))/);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Look for equality conditions
      const equalityMatches = whereClause.match(/(\w+)\s*=\s*\?/g);
      if (equalityMatches) {
        equalityMatches.forEach(match => {
          const column = match.split('=')[0].trim();
          suggestions.push({
            type: 'single_column',
            columns: [column],
            reason: 'Equality condition in WHERE clause'
          });
        });
      }
    }

    // Extract ORDER BY columns
    const orderByMatch = sqlLower.match(/order\s+by\s+([^;]+)/);
    if (orderByMatch) {
      const orderByClause = orderByMatch[1];
      const columns = orderByClause.split(',').map(col => 
        col.trim().split(' ')[0] // Remove ASC/DESC
      );
      
      suggestions.push({
        type: 'composite',
        columns: columns,
        reason: 'ORDER BY clause optimization'
      });
    }

    return suggestions;
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    const stats = [];
    
    for (const [sql, data] of this.queryStats.entries()) {
      stats.push({
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        ...data
      });
    }
    
    return stats.sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit = 10) {
    return this.getQueryStats()
      .filter(stat => stat.avgTime > this.slowQueryThreshold)
      .slice(0, limit);
  }

  /**
   * Get most frequent queries
   */
  getMostFrequentQueries(limit = 10) {
    return this.getQueryStats()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear statistics
   */
  clearStats() {
    this.queryStats.clear();
  }

  /**
   * Export statistics as JSON
   */
  exportStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      slowQueryThreshold: this.slowQueryThreshold,
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stat) => sum + stat.count, 0),
      uniqueQueries: this.queryStats.size,
      queries: this.getQueryStats()
    };

    return JSON.stringify(stats, null, 2);
  }
}

// Create singleton instance
const queryOptimizer = new QueryOptimizer();

export { queryOptimizer as QueryOptimizer };
export default QueryOptimizer;