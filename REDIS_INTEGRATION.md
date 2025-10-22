# Redis Integration Guide

This document explains the Redis integration implemented in the Nexus UI Backend for session management and distributed rate limiting.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Features](#features)
5. [Usage](#usage)
6. [Fallback Strategy](#fallback-strategy)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Redis is integrated as an optional performance enhancement for:
- **Session Storage** - Fast, distributed session management
- **Rate Limiting** - Distributed rate limiting across multiple server instances
- **Caching** - General-purpose caching layer

### Why Redis?

- **Performance** - In-memory data store (sub-millisecond latency)
- **Scalability** - Shared state across multiple server instances
- **Persistence** - Optional data persistence (AOF, RDB)
- **Atomic Operations** - Built-in atomic operations for counters
- **TTL Support** - Automatic expiration of keys

---

## Installation

### 1. Install Redis Server

#### **Windows** (Using WSL2):
```bash
# Install WSL2
wsl --install

# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Expected output: PONG
```

#### **macOS** (Using Homebrew):
```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Test connection
redis-cli ping
```

#### **Linux** (Ubuntu/Debian):
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

#### **Docker** (All Platforms):
```bash
# Run Redis in Docker
docker run -d --name redis -p 6379:6379 redis:latest

# Test connection
docker exec -it redis redis-cli ping
```

### 2. Install Node.js Packages

Already included in `package.json`:
```bash
npm install redis connect-redis rate-limit-redis
```

---

## Configuration

### Environment Variables

Add to `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Optional: Leave empty for local development
REDIS_DB=0               # Database number (0-15)
REDIS_TLS=false          # Enable for production with TLS
```

### Redis Connection Settings

Located in `src/config/redis.js`:

```javascript
{
  host: 'localhost',
  port: 6379,
  password: undefined,    // Optional
  database: 0,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Max retries');
      return Math.min(retries * 100, 3000);
    }
  }
}
```

---

## Features

### 1. Session Storage

Redis is used as the preferred session store (falls back to MongoDB if unavailable).

**Benefits:**
- Faster session lookup
- Shared sessions across server instances
- Automatic session expiration
- Lower database load

**Configuration:** `src/config/session.js`

```javascript
// Session automatically uses Redis if available
import { createSessionMiddleware } from './config/session.js';

app.use(createSessionMiddleware());
```

**Session Keys Pattern:**
```
sess:<sessionId>
```

**TTL:** 30 minutes (configurable via `SESSION_MAX_AGE`)

### 2. Distributed Rate Limiting

Redis enables rate limiting to work across multiple server instances.

**Rate Limiters Available:**

#### **Global Rate Limiter**
```javascript
import { createGlobalRateLimiter } from './middleware/redisRateLimiter.js';

app.use(createGlobalRateLimiter());
// 100 requests per 15 minutes per IP
```

#### **Authentication Rate Limiter**
```javascript
import { createAuthRateLimiter } from './middleware/redisRateLimiter.js';

app.post('/api/v1/auth/login', createAuthRateLimiter(), handleLogin);
// 20 requests per 15 minutes per IP
// Skips successful requests
```

#### **Registration Rate Limiter**
```javascript
import { createRegisterRateLimiter } from './middleware/redisRateLimiter.js';

app.post('/api/v1/auth/register', createRegisterRateLimiter(), handleRegister);
// 3 requests per hour per IP
```

#### **User-Based Rate Limiter**
```javascript
import { createUserRateLimiter } from './middleware/redisRateLimiter.js';

app.post('/api/v1/posts', authenticate, createUserRateLimiter(50, 60), createPost);
// 50 requests per hour per user (not per IP)
```

#### **Custom Rate Limiter**
```javascript
import { createCustomRateLimiter } from './middleware/redisRateLimiter.js';

const limiter = createCustomRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests
  message: 'Custom rate limit exceeded',
  prefix: 'rl:custom:',
});

app.use('/api/v1/expensive', limiter);
```

**Rate Limit Keys Pattern:**
```
rl:global:<ip>
rl:auth:<ip>
rl:register:<ip>
rl:user:<userId>
rl:api:<ip>
```

### 3. Helper Functions

**Set with Expiry:**
```javascript
import { setWithExpiry } from './config/redis.js';

await setWithExpiry('user:123:temp', { data: 'value' }, 3600);
// Expires in 1 hour
```

**Get Value:**
```javascript
import { get } from './config/redis.js';

const value = await get('user:123:temp');
```

**Delete Key:**
```javascript
import { del } from './config/redis.js';

await del('user:123:temp');
```

**Check Existence:**
```javascript
import { exists } from './config/redis.js';

const keyExists = await exists('user:123:temp');
```

**Increment Counter:**
```javascript
import { incr } from './config/redis.js';

const count = await incr('api:calls:count');
```

**Delete by Pattern:**
```javascript
import { deleteByPattern } from './config/redis.js';

await deleteByPattern('user:123:*');
// Deletes all keys matching pattern
```

---

## Fallback Strategy

The application is designed to work **without Redis**. If Redis is not available:

### Session Storage
- **Falls back to:** MongoDB session store
- **Impact:** Slightly slower session lookup
- **Behavior:** Seamless, no code changes required

### Rate Limiting
- **Falls back to:** Memory-based rate limiting
- **Impact:** Rate limits per server instance (not distributed)
- **Behavior:** Still functional, but not shared across instances

### Application Startup
```
✅ Redis connected successfully (if available)
⚠️  App will run without Redis (if unavailable)
```

**Important:** In production with multiple server instances, Redis is **highly recommended** for:
- Shared sessions
- Distributed rate limiting
- Consistent user experience

---

## Monitoring

### Check Redis Connection Status

```javascript
import { isRedisConnected } from './config/redis.js';

if (isRedisConnected()) {
  console.log('Redis is connected');
}
```

### Monitor Redis Performance

**Using Redis CLI:**
```bash
# Connect to Redis
redis-cli

# Get info
INFO

# Monitor commands in real-time
MONITOR

# Check memory usage
MEMORY USAGE <key>

# Get all keys (use with caution in production)
KEYS *

# Get key count
DBSIZE

# Check slow log
SLOWLOG GET 10
```

**Using Node.js:**
```javascript
import { getRedisClient } from './config/redis.js';

const client = getRedisClient();

// Get server info
const info = await client.info();

// Get database size
const size = await client.dbSize();

// Get memory stats
const memory = await client.memoryUsage('key');
```

### Health Check Endpoint

Add Redis health check:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: isRedisConnected() ? 'connected' : 'disconnected',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  res.status(200).json(health);
});
```

---

## Troubleshooting

### Issue: Cannot connect to Redis

**Error:** `Redis Client Error: connect ECONNREFUSED`

**Solutions:**
1. Check if Redis server is running:
   ```bash
   # Linux/Mac
   redis-cli ping

   # Windows (WSL)
   wsl redis-cli ping

   # Docker
   docker exec -it redis redis-cli ping
   ```

2. Check Redis is listening on correct port:
   ```bash
   netstat -an | grep 6379
   ```

3. Verify Redis configuration in `.env`:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

4. Check firewall rules (production)

### Issue: Redis connection keeps dropping

**Error:** Frequent reconnection attempts

**Solutions:**
1. Increase connection timeout:
   ```javascript
   socket: {
     connectTimeout: 10000,
     keepAlive: 30000,
   }
   ```

2. Check network stability

3. Review Redis server logs:
   ```bash
   # Linux/Mac
   sudo tail -f /var/log/redis/redis-server.log

   # Docker
   docker logs redis
   ```

### Issue: Rate limiting not working across instances

**Problem:** Rate limits reset when scaling to multiple servers

**Solution:** Ensure Redis is configured (not using memory store):
```javascript
// Check logs for:
// "Using Redis for rate limiting" ✅
// "Using memory store for rate limiting" ❌
```

### Issue: High memory usage

**Problem:** Redis using too much memory

**Solutions:**
1. Set maxmemory policy:
   ```bash
   # In redis.conf
   maxmemory 256mb
   maxmemory-policy allkeys-lru
   ```

2. Monitor key expiration:
   ```bash
   redis-cli
   TTL <key>
   ```

3. Clean up old keys:
   ```bash
   redis-cli --scan --pattern "old:*" | xargs redis-cli del
   ```

### Issue: Slow Redis queries

**Problem:** Redis operations taking too long

**Solutions:**
1. Check slow log:
   ```bash
   redis-cli SLOWLOG GET 10
   ```

2. Avoid O(N) operations on large datasets:
   - Don't use `KEYS *` in production
   - Use `SCAN` instead of `KEYS`
   - Use Redis hashes for complex objects

3. Monitor with Redis commands:
   ```bash
   redis-cli --latency
   ```

---

## Performance Optimization

### Best Practices

1. **Use Appropriate Data Structures**
   - Strings for simple values
   - Hashes for objects
   - Sets for unique collections
   - Sorted Sets for rankings

2. **Set Appropriate TTLs**
   ```javascript
   // Short TTL for frequently changing data
   await setWithExpiry('temp:data', value, 300); // 5 minutes

   // Longer TTL for stable data
   await setWithExpiry('config:app', value, 3600); // 1 hour
   ```

3. **Use Connection Pooling**
   Already configured in `redis.js`

4. **Batch Operations**
   ```javascript
   const pipeline = client.multi();
   pipeline.set('key1', 'value1');
   pipeline.set('key2', 'value2');
   await pipeline.exec();
   ```

5. **Monitor Memory Usage**
   ```bash
   redis-cli INFO memory
   ```

---

## Production Deployment

### Redis Security Checklist

- [ ] Enable authentication (`requirepass` in redis.conf)
- [ ] Use TLS for Redis connections
- [ ] Bind Redis to specific IP (not 0.0.0.0)
- [ ] Use firewall rules to restrict access
- [ ] Enable protected mode
- [ ] Disable dangerous commands (FLUSHALL, FLUSHDB, KEYS)
- [ ] Set maxmemory limit
- [ ] Enable AOF or RDB persistence
- [ ] Monitor Redis with external tools
- [ ] Regular backups

### Redis Configuration for Production

```bash
# redis.conf (production settings)
bind 127.0.0.1 ::1
protected-mode yes
port 6379
requirepass <strong-password>
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Security
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG "CONFIG_SECRET_NAME"
```

### Environment Variables for Production

```env
REDIS_HOST=redis.production.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_TLS=true
```

---

## Redis Commands Reference

### Useful Commands

```bash
# Connection
PING                          # Test connection
SELECT 0                      # Select database
AUTH password                 # Authenticate

# Keys
SET key value                 # Set value
GET key                       # Get value
DEL key                       # Delete key
EXISTS key                    # Check if key exists
EXPIRE key 3600              # Set TTL (seconds)
TTL key                       # Get remaining TTL
KEYS pattern                  # Find keys (avoid in production)
SCAN 0 MATCH pattern COUNT 100 # Iterate keys safely

# Hashes
HSET hash field value         # Set hash field
HGET hash field               # Get hash field
HGETALL hash                  # Get all hash fields
HDEL hash field               # Delete hash field

# Lists
LPUSH list value              # Add to list (left)
RPUSH list value              # Add to list (right)
LRANGE list 0 -1             # Get all list items

# Sets
SADD set member               # Add to set
SMEMBERS set                  # Get all set members
SISMEMBER set member          # Check membership

# Sorted Sets
ZADD zset score member        # Add to sorted set
ZRANGE zset 0 -1             # Get all members (sorted)

# Server
INFO                          # Get server info
DBSIZE                        # Get key count
FLUSHDB                       # Clear current database
FLUSHALL                      # Clear all databases
MONITOR                       # Monitor commands
SLOWLOG GET 10               # Get slow queries
```

---

## Resources

- [Redis Official Documentation](https://redis.io/documentation)
- [Node Redis Client](https://github.com/redis/node-redis)
- [Connect Redis](https://github.com/tj/connect-redis)
- [Rate Limit Redis](https://github.com/wyattjoh/rate-limit-redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Redis Security](https://redis.io/docs/manual/security/)

---

**Last Updated:** October 2024

**Redis Version:** 7.x+
**Node Redis Version:** 5.x+
