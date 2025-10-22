import session from 'express-session';
import MongoStore from 'connect-mongo';
import RedisStore from 'connect-redis';
import { getRedisClient, isRedisConnected } from './redis.js';
import config from './environment.js';
import logger from '../utils/logger.js';

/**
 * Create session store based on available backend
 * Priority: Redis > MongoDB > Memory
 */
const createSessionStore = () => {
  // Try Redis first (preferred for sessions)
  if (isRedisConnected()) {
    logger.info('Using Redis for session storage');
    return new RedisStore({
      client: getRedisClient(),
      prefix: 'sess:',
      ttl: config.session.maxAge / 1000, // seconds
    });
  }

  // Fallback to MongoDB
  logger.info('Using MongoDB for session storage');
  return MongoStore.create({
    mongoUrl: config.database.mongodb.uri,
    ttl: config.session.maxAge / 1000, // Time to live in seconds
    autoRemove: 'native', // Use MongoDB's TTL feature
    touchAfter: 24 * 3600, // Lazy session update (once per 24h)
    crypto: {
      secret: config.session.secret,
    },
    collectionName: 'sessions',
  });
};

/**
 * Session Configuration
 * Secure session management with Redis (preferred) or MongoDB store
 */
export const createSessionConfig = () => {
  return {
    secret: config.session.secret,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    name: 'sessionId', // Custom session cookie name (not 'connect.sid')

    cookie: {
      httpOnly: config.session.httpOnly, // Prevent XSS attacks
      secure: config.session.secure, // HTTPS only in production
      sameSite: config.session.sameSite, // CSRF protection
      maxAge: config.session.maxAge, // 30 minutes
      domain: process.env.COOKIE_DOMAIN || undefined,
    },

    // Session store (Redis or MongoDB)
    store: createSessionStore(),

    // Rolling session - Reset maxAge on every response
    rolling: true,

    // Proxy trust for production (behind nginx, etc.)
    proxy: config.nodeEnv === 'production',
  };
};

/**
 * Session middleware factory
 */
export const createSessionMiddleware = () => {
  return session(createSessionConfig());
};

/**
 * Regenerate session ID (prevent session fixation)
 */
export const regenerateSession = (req) => {
  return new Promise((resolve, reject) => {
    const oldSession = req.session;
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        // Restore session data
        Object.assign(req.session, oldSession);
        resolve(req.session);
      }
    });
  });
};

/**
 * Destroy session
 */
export const destroySession = (req) => {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Check if session is expired
 */
export const isSessionExpired = (req) => {
  if (!req.session || !req.session.cookie) {
    return true;
  }

  const now = Date.now();
  const expires = new Date(req.session.cookie.expires).getTime();

  return now > expires;
};

/**
 * Extend session expiry
 */
export const extendSession = (req) => {
  if (req.session && req.session.cookie) {
    req.session.cookie.maxAge = config.session.maxAge;
  }
};

/**
 * Get active sessions count for user
 */
export const getUserSessionCount = async (userId, store) => {
  return new Promise((resolve, reject) => {
    store.all((err, sessions) => {
      if (err) {
        reject(err);
      } else {
        const userSessions = sessions?.filter(
          (s) => s.userId === userId
        ) || [];
        resolve(userSessions.length);
      }
    });
  });
};

export default {
  createSessionConfig,
  createSessionMiddleware,
  regenerateSession,
  destroySession,
  isSessionExpired,
  extendSession,
  getUserSessionCount,
};
