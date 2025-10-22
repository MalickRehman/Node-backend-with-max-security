import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Create Redis-based rate limiter
 * Falls back to memory store if Redis is not available
 */

/**
 * Global rate limiter
 */
export const createGlobalRateLimiter = () => {
  const options = {
    windowMs: config.rateLimit.windowMs, // 15 minutes
    max: config.rateLimit.maxRequests, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
      });
    },
  };

  // Use Redis store if available
  if (isRedisConnected()) {
    logger.info('Using Redis for global rate limiting');
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'rl:global:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  } else {
    logger.info('Using memory store for global rate limiting (Redis not available)');
  }

  return rateLimit(options);
};

/**
 * Authentication rate limiter (stricter)
 */
export const createAuthRateLimiter = () => {
  const options = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.rateLimit.loginMax, // 20 attempts per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req, res) => {
      logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'Too many authentication attempts, please try again later.',
      });
    },
  };

  if (isRedisConnected()) {
    logger.info('Using Redis for auth rate limiting');
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'rl:auth:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  } else {
    logger.info('Using memory store for auth rate limiting (Redis not available)');
  }

  return rateLimit(options);
};

/**
 * Registration rate limiter (very strict)
 */
export const createRegisterRateLimiter = () => {
  const options = {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many accounts created from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Register rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'Too many accounts created from this IP, please try again later.',
      });
    },
  };

  if (isRedisConnected()) {
    logger.info('Using Redis for register rate limiting');
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'rl:register:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  } else {
    logger.info('Using memory store for register rate limiting (Redis not available)');
  }

  return rateLimit(options);
};

/**
 * API endpoint rate limiter
 */
export const createApiRateLimiter = (maxRequests = 100, windowMinutes = 15) => {
  const options = {
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: `Too many API requests, please try again later.`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`API rate limit exceeded for IP: ${req.ip}, endpoint: ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Too many API requests, please try again later.',
      });
    },
  };

  if (isRedisConnected()) {
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'rl:api:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  }

  return rateLimit(options);
};

/**
 * Slow down middleware for gradual throttling
 * Increases response time instead of blocking
 */
export const createSlowDown = (delayAfter = 5, delayMs = 500) => {
  const options = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter, // Allow this many requests per window
    delayMs, // Add delay per request
    maxDelayMs: 20000, // Maximum 20 seconds delay
  };

  if (isRedisConnected()) {
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'slow:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  }

  return require('express-slow-down')(options);
};

/**
 * Per-user rate limiter (requires authentication)
 */
export const createUserRateLimiter = (max = 100, windowMinutes = 15) => {
  const options = {
    windowMs: windowMinutes * 60 * 1000,
    max,
    message: 'You have exceeded the rate limit for this action.',
    standardHeaders: true,
    legacyHeaders: false,
    // Use user ID as key instead of IP
    keyGenerator: (req) => {
      return req.user ? req.user._id.toString() : req.ip;
    },
    handler: (req, res) => {
      logger.warn(`User rate limit exceeded for user: ${req.user?._id}, IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'You have exceeded the rate limit for this action.',
      });
    },
  };

  if (isRedisConnected()) {
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: 'rl:user:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  }

  return rateLimit(options);
};

/**
 * Flexible rate limiter factory
 */
export const createCustomRateLimiter = (customOptions = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  };

  const options = { ...defaultOptions, ...customOptions };

  if (isRedisConnected() && !options.store) {
    options.store = new RedisStore({
      client: getRedisClient(),
      prefix: options.prefix || 'rl:custom:',
      sendCommand: (...args) => getRedisClient().sendCommand(args),
    });
  }

  return rateLimit(options);
};

/**
 * Reset rate limit for a specific key (admin function)
 */
export const resetRateLimit = async (key, prefix = 'rl:') => {
  if (!isRedisConnected()) {
    logger.warn('Cannot reset rate limit: Redis not connected');
    return false;
  }

  try {
    const fullKey = `${prefix}${key}`;
    await getRedisClient().del(fullKey);
    logger.info(`Rate limit reset for key: ${fullKey}`);
    return true;
  } catch (error) {
    logger.error(`Error resetting rate limit for key ${key}:`, error);
    return false;
  }
};

/**
 * Get current rate limit status for a key
 */
export const getRateLimitStatus = async (key, prefix = 'rl:') => {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const fullKey = `${prefix}${key}`;
    const value = await getRedisClient().get(fullKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error(`Error getting rate limit status for key ${key}:`, error);
    return null;
  }
};

export default {
  createGlobalRateLimiter,
  createAuthRateLimiter,
  createRegisterRateLimiter,
  createApiRateLimiter,
  createSlowDown,
  createUserRateLimiter,
  createCustomRateLimiter,
  resetRateLimit,
  getRateLimitStatus,
};
