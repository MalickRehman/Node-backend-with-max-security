# Monitoring and Alerting

Comprehensive monitoring setup with Sentry, Prometheus, and alerting.

## Overview

- **Error Tracking**: Sentry for error monitoring and performance
- **Metrics**: Prometheus for application metrics
- **Logging**: Winston for structured logging
- **Health Checks**: Kubernetes-ready health endpoints
- **Alerting**: Integration with PagerDuty, Slack, email

## Quick Start

### 1. Configure Environment

Add to `.env`:

```env
# Sentry (Error Tracking)
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456

# New Relic (APM - Optional)
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

### 2. Enable Monitoring

Sentry is automatically initialized if `SENTRY_DSN` is configured.

### 3. Access Metrics

```bash
# Prometheus metrics endpoint (admin only)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/v1/metrics

# JSON format
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/v1/metrics/json
```

## Sentry Integration

### Features

- ✅ Automatic error capture
- ✅ Performance monitoring
- ✅ Profiling
- ✅ Request tracing
- ✅ User context
- ✅ Breadcrumbs
- ✅ Release tracking

### Setup

**1. Create Sentry Account**

- Sign up at https://sentry.io
- Create a new project (Node.js)
- Copy the DSN

**2. Configure**

```env
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456
```

**3. Usage**

```javascript
import { captureException, captureMessage, setUserContext } from '../config/monitoring.js';

// Capture error
try {
  riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { feature: 'payment' },
    extra: { amount: 100 },
  });
}

// Capture message
captureMessage('Important event occurred', 'info', {
  tags: { category: 'business' },
});

// Set user context
setUserContext({
  id: user.id,
  email: user.email,
  username: user.username,
});
```

### Automatic Tracking

All unhandled errors and HTTP errors (status >= 500) are automatically sent to Sentry.

### Performance Monitoring

Transaction traces for:
- HTTP requests
- Database queries
- Redis operations
- External API calls

### Data Privacy

Sensitive data is automatically filtered:
- Authorization headers
- Cookies
- Session tokens
- Passwords

## Prometheus Metrics

### Available Metrics

#### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration

#### Authentication
- `auth_attempts_total` - Authentication attempts
- `auth_failures_total` - Failed auth attempts

#### Database
- `db_query_duration_seconds` - Query duration
- `db_connections_active` - Active connections

#### Redis
- `redis_operation_duration_seconds` - Operation duration

#### Security
- `security_events_total` - Security events
- `malware_detected_total` - Malware detections
- `rate_limit_hits_total` - Rate limit hits

#### Files
- `file_uploads_total` - File uploads

#### Errors
- `api_errors_total` - API errors

#### Cache
- `cache_hits_total` - Cache hits
- `cache_misses_total` - Cache misses

### Prometheus Server Setup

**Docker Compose**

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'nexus-backend'
    static_configs:
      - targets: ['backend:5000']
    basic_auth:
      username: 'admin'
      password: 'your-password'
    metrics_path: '/api/v1/metrics'
```

Add to `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: nexus-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - nexus-network

  grafana:
    image: grafana/grafana:latest
    container_name: nexus-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - nexus-network

volumes:
  prometheus_data:
  grafana_data:
```

Start:

```bash
docker-compose up -d prometheus grafana
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

### Grafana Dashboards

**1. Import Node.js Dashboard**

- Go to Grafana → Dashboards → Import
- Enter ID: `11159` (Node.js Application Dashboard)
- Select Prometheus data source

**2. Custom Dashboard**

Create dashboard with panels for:
- Request rate and latency
- Error rate
- Authentication failures
- Database query performance
- Memory and CPU usage

### Alerting

**Prometheus Alerts**

Create `alerts.yml`:

```yaml
groups:
  - name: nexus-backend-alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      # Failed auth attempts
      - alert: HighAuthFailures
        expr: rate(auth_failures_total[5m]) > 5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"
          description: "{{ $value }} failed attempts/sec"

      # Database slow queries
      - alert: SlowDatabaseQueries
        expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries"
          description: "95th percentile query time is {{ $value }}s"

      # Memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 400
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB"

      # Malware detections
      - alert: MalwareDetected
        expr: increase(malware_detected_total[1h]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Malware detected in file uploads"
          description: "{{ $value }} malware detections in last hour"
```

Add to `prometheus.yml`:

```yaml
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## Logging

### Winston Logger

Configured with:
- Console transport (development)
- File transport (production)
- Error file (errors only)
- Log rotation (14 days)

### Log Levels

```javascript
logger.error('Critical error', { error, userId });
logger.warn('Warning message', { context });
logger.info('Info message');
logger.debug('Debug message');
```

### Structured Logging

```javascript
logger.info('User logged in', {
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date(),
});
```

### Log Files

```
logs/
├── combined.log      # All logs
├── error.log         # Errors only
├── pm2-out.log       # PM2 stdout
└── pm2-error.log     # PM2 stderr
```

### Log Rotation

Automatic rotation:
- Max size: 20MB
- Max files: 30 days
- Compression: gzip

## Health Checks

### Endpoints

**Basic Health**
```bash
GET /api/v1/health
```

**Detailed Health** (with dependencies)
```bash
GET /api/v1/health/detailed
```

**Readiness Probe** (Kubernetes)
```bash
GET /api/v1/health/ready
```

**Liveness Probe** (Kubernetes)
```bash
GET /api/v1/health/live
```

### Kubernetes Integration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: backend
      livenessProbe:
        httpGet:
          path: /api/v1/health/live
          port: 5000
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /api/v1/health/ready
          port: 5000
        initialDelaySeconds: 10
        periodSeconds: 5
```

## Alerting Channels

### Slack Integration

**1. Create Slack Webhook**

- Go to https://api.slack.com/apps
- Create app → Incoming Webhooks
- Copy webhook URL

**2. Configure Alertmanager**

```yaml
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'Nexus Backend Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

### Email Alerts

```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'ops@yourdomain.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@gmail.com'
        auth_password: 'your-password'
```

### PagerDuty Integration

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ .CommonAnnotations.summary }}'
```

## Performance Monitoring

### Application Performance Monitoring (APM)

**Sentry Performance**

Automatically tracks:
- HTTP request latency
- Database query time
- External API calls
- Memory usage
- CPU usage

**New Relic (Optional)**

```env
NEW_RELIC_LICENSE_KEY=your-key
NEW_RELIC_APP_NAME=Nexus Backend
```

Install:
```bash
npm install newrelic
```

Add to `src/app.js` (first line):
```javascript
import 'newrelic';
```

### Database Monitoring

MongoDB slow query logging enabled automatically.

Check slow queries:
```javascript
db.system.profile.find().limit(10).sort({ ts: -1 }).pretty()
```

### Redis Monitoring

Use Redis Commander (development):
```bash
docker-compose -f docker-compose.dev.yml up redis-commander
```

Access: http://localhost:8082

## Dashboards

### Recommended Dashboards

**Grafana**
- Node.js Application Dashboard (ID: 11159)
- MongoDB Dashboard (ID: 2583)
- Redis Dashboard (ID: 763)

**Pre-built Queries**

Request rate:
```promql
rate(http_requests_total[5m])
```

Error rate:
```promql
rate(api_errors_total[5m])
```

Average response time:
```promql
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])
```

Database query time (95th percentile):
```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

## Best Practices

1. ✅ Monitor error rates and set alerts
2. ✅ Track authentication failures
3. ✅ Monitor database performance
4. ✅ Set up log aggregation
5. ✅ Configure rate limit alerts
6. ✅ Monitor memory and CPU usage
7. ✅ Track security events
8. ✅ Set up on-call rotation
9. ✅ Regular review of alerts
10. ✅ Document incident response

## Troubleshooting

### High Memory Usage

```bash
# Check memory
pm2 monit

# Heap snapshot
node --inspect src/app.js
```

### High CPU Usage

```bash
# Profile CPU
node --prof src/app.js

# Analyze profile
node --prof-process isolate-*.log
```

### Slow Requests

Check Sentry Performance tab for transaction traces.

### Missing Metrics

```bash
# Verify metrics endpoint
curl http://localhost:5000/api/v1/metrics

# Check Prometheus targets
http://localhost:9090/targets
```

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PM2 Monitoring](https://pm2.keymetrics.io/docs/usage/monitoring/)

---

**Last Updated**: October 2024
**Version**: 1.0.0
