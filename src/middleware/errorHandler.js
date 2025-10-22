import logger, { logSecurityEvent } from '../utils/logger.js';
import config from '../config/environment.js';
import ApiError from '../utils/ApiError.js';

/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

/**
 * Convert unknown errors to ApiError
 */
const convertToApiError = (err, req) => {
  let error = err;

  // If it's not already an ApiError, convert it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  return error;
};

/**
 * Handle specific error types
 */
const handleSpecificErrors = (err) => {
  let error = err;

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token expired');
  }

  // Validation Errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    error = ApiError.badRequest(message);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`${field} already exists`);
  }

  // MongoDB Cast Error
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  return error;
};

/**
 * Log error with appropriate level
 */
const logError = (error, req) => {
  const errorInfo = {
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId: req.id,
    userAgent: req.get('user-agent'),
    userId: req.userId,
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server Error:', errorInfo);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error:', errorInfo);
  } else {
    logger.info('Error:', errorInfo);
  }

  // Log security events for specific errors
  if (error.statusCode === 401 || error.statusCode === 403) {
    logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
      message: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.userId,
    });
  }
};

/**
 * Get error response based on environment
 */
const getErrorResponse = (error, req) => {
  const response = {
    success: false,
    message: error.message,
    statusCode: error.statusCode,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    response.stack = error.stack;
    response.path = req.path;
    response.method = req.method;
  }

  // Don't expose internal error details in production
  if (config.nodeEnv === 'production' && error.statusCode === 500) {
    response.message = 'Internal Server Error';
  }

  return response;
};

/**
 * Main error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Handle specific error types
  let error = handleSpecificErrors(err);

  // Convert to ApiError if needed
  error = convertToApiError(error, req);

  // Log the error
  logError(error, req);

  // Send error response
  const response = getErrorResponse(error, req);
  res.status(error.statusCode).json(response);
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route not found: ${req.method} ${req.path}`);

  logSecurityEvent('ROUTE_NOT_FOUND', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  next(error);
};

/**
 * Async error wrapper
 * Catches errors in async route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason.message || reason,
    stack: reason.stack,
    promise,
  });

  // Log security event for critical errors
  logSecurityEvent('UNHANDLED_REJECTION', {
    reason: reason.message || reason,
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
  });

  // Log security event
  logSecurityEvent('UNCAUGHT_EXCEPTION', {
    message: error.message,
  });

  // Exit process (let process manager restart it)
  process.exit(1);
};

/**
 * Validation error formatter
 */
export const formatValidationErrors = (errors) => {
  return errors.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
    location: error.location,
  }));
};

/**
 * Error response helper
 */
export const sendErrorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  formatValidationErrors,
  sendErrorResponse,
};
