import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger.js';

/**
 * Prometheus Metrics Service
 * Collects and exposes application metrics
 */

class MetricsService {
  constructor() {
    // Create a Registry
    this.register = new Registry();

    // Add default Node.js metrics
    collectDefaultMetrics({ register: this.register });

    // Initialize custom metrics
    this.initializeMetrics();

    logger.info('✅ Metrics service initialized');
  }

  initializeMetrics() {
    // HTTP Request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // Authentication metrics
    this.authAttemptsTotal = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'result'],
      registers: [this.register],
    });

    this.authFailuresTotal = new Counter({
      name: 'auth_failures_total',
      help: 'Total number of failed authentication attempts',
      labelNames: ['type', 'reason'],
      registers: [this.register],
    });

    // Database metrics
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'collection'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register],
    });

    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [this.register],
    });

    // Redis metrics
    this.redisOperationsDuration = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.register],
    });

    // File upload metrics
    this.fileUploadsTotal = new Counter({
      name: 'file_uploads_total',
      help: 'Total number of file uploads',
      labelNames: ['result'],
      registers: [this.register],
    });

    this.malwareDetected = new Counter({
      name: 'malware_detected_total',
      help: 'Total number of malware detections',
      labelNames: ['virus_type'],
      registers: [this.register],
    });

    // API errors
    this.apiErrorsTotal = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['type', 'route'],
      registers: [this.register],
    });

    // Security events
    this.securityEventsTotal = new Counter({
      name: 'security_events_total',
      help: 'Total number of security events',
      labelNames: ['event_type', 'severity'],
      registers: [this.register],
    });

    // Rate limiting
    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['route'],
      registers: [this.register],
    });

    // Active users
    this.activeUsers = new Gauge({
      name: 'active_users_total',
      help: 'Number of active users',
      registers: [this.register],
    });

    // Cache metrics
    this.cacheHitsTotal = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [this.register],
    });

    this.cacheMissesTotal = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [this.register],
    });
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestsTotal.labels(method, route, statusCode).inc();
    this.httpRequestDuration.labels(method, route, statusCode).observe(duration);
  }

  /**
   * Record authentication attempt
   */
  recordAuthAttempt(type, result) {
    this.authAttemptsTotal.labels(type, result).inc();
  }

  /**
   * Record authentication failure
   */
  recordAuthFailure(type, reason) {
    this.authFailuresTotal.labels(type, reason).inc();
  }

  /**
   * Record database query
   */
  recordDbQuery(operation, collection, duration) {
    this.dbQueryDuration.labels(operation, collection).observe(duration);
  }

  /**
   * Update active database connections
   */
  updateDbConnections(count) {
    this.dbConnectionsActive.set(count);
  }

  /**
   * Record Redis operation
   */
  recordRedisOperation(operation, duration) {
    this.redisOperationsDuration.labels(operation).observe(duration);
  }

  /**
   * Record file upload
   */
  recordFileUpload(result) {
    this.fileUploadsTotal.labels(result).inc();
  }

  /**
   * Record malware detection
   */
  recordMalwareDetection(virusType) {
    this.malwareDetected.labels(virusType).inc();
  }

  /**
   * Record API error
   */
  recordApiError(type, route) {
    this.apiErrorsTotal.labels(type, route).inc();
  }

  /**
   * Record security event
   */
  recordSecurityEvent(eventType, severity) {
    this.securityEventsTotal.labels(eventType, severity).inc();
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(route) {
    this.rateLimitHitsTotal.labels(route).inc();
  }

  /**
   * Update active users count
   */
  updateActiveUsers(count) {
    this.activeUsers.set(count);
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType) {
    this.cacheHitsTotal.labels(cacheType).inc();
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType) {
    this.cacheMissTotal.labels(cacheType).inc();
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return await this.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON() {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.register.resetMetrics();
  }
}

// Export singleton instance
const metricsService = new MetricsService();
export default metricsService;
