import { createClient } from 'redis';
import config from './environment.js';
import logger from '../utils/logger.js';

let redisClient = null;
let isConnected = false;

/**
 * Create and configure Redis client
 */
export const createRedisClient = async () => {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    // Create Redis client with configuration
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        ...(config.redis.tls && { tls: true }),
      },
      password: config.redis.password || undefined,
      database: config.redis.db,
      // Connection retry strategy
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Redis connection failed');
          }
          const delay = Math.min(retries * 100, 3000);
          logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    // Error handling
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client connected and ready');
      isConnected = true;
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();

    logger.info({
      message: '✅ Redis connected successfully',
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Don't throw error - allow app to run without Redis
    // Redis is optional for development
    logger.warn('⚠️  App will run without Redis (sessions and rate limiting will use memory)');
    return null;
  }
};

/**
 * Get existing Redis client
 */
export const getRedisClient = () => {
  if (!redisClient || !isConnected) {
    logger.warn('Redis client not connected');
    return null;
  }
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedisConnection = async () => {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
      isConnected = false;
      redisClient = null;
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      // Force disconnect
      await redisClient.disconnect();
      isConnected = false;
      redisClient = null;
    }
  }
};

/**
 * Check if Redis is connected
 */
export const isRedisConnected = () => {
  return isConnected && redisClient !== null;
};

/**
 * Redis helper functions
 */

/**
 * Set key with expiration
 */
export const setWithExpiry = async (key, value, ttlSeconds) => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error(`Redis SET error for key ${key}:`, error);
    return false;
  }
};

/**
 * Get value by key
 */
export const get = async (key) => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Redis GET error for key ${key}:`, error);
    return null;
  }
};

/**
 * Delete key
 */
export const del = async (key) => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Redis DEL error for key ${key}:`, error);
    return false;
  }
};

/**
 * Check if key exists
 */
export const exists = async (key) => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Redis EXISTS error for key ${key}:`, error);
    return false;
  }
};

/**
 * Increment key
 */
export const incr = async (key) => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    return await client.incr(key);
  } catch (error) {
    logger.error(`Redis INCR error for key ${key}:`, error);
    return null;
  }
};

/**
 * Set expiration on existing key
 */
export const expire = async (key, seconds) => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.expire(key, seconds);
    return true;
  } catch (error) {
    logger.error(`Redis EXPIRE error for key ${key}:`, error);
    return false;
  }
};

/**
 * Get all keys matching pattern
 */
export const keys = async (pattern) => {
  const client = getRedisClient();
  if (!client) return [];

  try {
    return await client.keys(pattern);
  } catch (error) {
    logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
    return [];
  }
};

/**
 * Delete all keys matching pattern
 */
export const deleteByPattern = async (pattern) => {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    const keysToDelete = await client.keys(pattern);
    if (keysToDelete.length > 0) {
      return await client.del(keysToDelete);
    }
    return 0;
  } catch (error) {
    logger.error(`Redis delete by pattern error for ${pattern}:`, error);
    return 0;
  }
};

/**
 * Flush all data (use with caution!)
 */
export const flushAll = async () => {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.flushAll();
    logger.warn('⚠️  Redis: All data flushed');
    return true;
  } catch (error) {
    logger.error('Redis FLUSHALL error:', error);
    return false;
  }
};

export default {
  createRedisClient,
  getRedisClient,
  closeRedisConnection,
  isRedisConnected,
  setWithExpiry,
  get,
  del,
  exists,
  incr,
  expire,
  keys,
  deleteByPattern,
  flushAll,
};
