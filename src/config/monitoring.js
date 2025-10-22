import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import config from './environment.js';
import logger from '../utils/logger.js';

/**
 * Initialize Sentry Error Tracking and Performance Monitoring
 */
export function initializeSentry(app) {
  if (!config.monitoring?.sentryDsn) {
    logger.warn('⚠️  Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn: config.monitoring.sentryDsn,
      environment: config.nodeEnv,
      release: `${config.app.name}@${config.app.version}`,

      // Performance Monitoring
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
      profilesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,

      // Integrations
      integrations: [
        // Enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express.js tracing
        new Sentry.Integrations.Express({ app }),
        // Enable MongoDB tracing
        new Sentry.Integrations.Mongo(),
        // Enable Redis tracing
        new Sentry.Integrations.Redis(),
        // Enable profiling
        nodeProfilingIntegration(),
      ],

      // Don't report errors in development (optional)
      enabled: config.nodeEnv !== 'test',

      // Before send hook - filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data from error reports
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }

        // Don't send health check errors
        if (event.request?.url?.includes('/health')) {
          return null;
        }

        return event;
      },

      // Ignore certain errors
      ignoreErrors: [
        'NetworkError',
        'AbortError',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
      ],
    });

    logger.info('✅ Sentry initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
    return false;
  }
}

/**
 * Get Sentry request handler middleware
 */
export function getSentryRequestHandler() {
  if (!config.monitoring?.sentryDsn) {
    return (req, res, next) => next();
  }
  return Sentry.Handlers.requestHandler();
}

/**
 * Get Sentry tracing handler middleware
 */
export function getSentryTracingHandler() {
  if (!config.monitoring?.sentryDsn) {
    return (req, res, next) => next();
  }
  return Sentry.Handlers.tracingHandler();
}

/**
 * Get Sentry error handler middleware
 */
export function getSentryErrorHandler() {
  if (!config.monitoring?.sentryDsn) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status code >= 500
      return error.statusCode >= 500;
    },
  });
}

/**
 * Capture exception with context
 */
export function captureException(error, context = {}) {
  if (!config.monitoring?.sentryDsn) {
    return;
  }

  Sentry.captureException(error, {
    tags: context.tags,
    extra: context.extra,
    user: context.user,
    level: context.level || 'error',
  });
}

/**
 * Capture message/event
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!config.monitoring?.sentryDsn) {
    return;
  }

  Sentry.captureMessage(message, {
    level,
    tags: context.tags,
    extra: context.extra,
    user: context.user,
  });
}

/**
 * Add breadcrumb for tracing
 */
export function addBreadcrumb(category, message, data = {}) {
  if (!config.monitoring?.sentryDsn) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user) {
  if (!config.monitoring?.sentryDsn) {
    return;
  }

  Sentry.setUser({
    id: user.id || user._id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  if (!config.monitoring?.sentryDsn) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name, operation) {
  if (!config.monitoring?.sentryDsn) {
    return {
      finish: () => {},
      setStatus: () => {},
      setData: () => {},
    };
  }

  return Sentry.startTransaction({
    op: operation,
    name,
  });
}

export default {
  initializeSentry,
  getSentryRequestHandler,
  getSentryTracingHandler,
  getSentryErrorHandler,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUserContext,
  clearUserContext,
  startTransaction,
};
