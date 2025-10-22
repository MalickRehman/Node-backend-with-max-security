import crypto from 'crypto';
import { logSecurityEvent } from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

/**
 * CSRF Protection Middleware
 * Implements Double Submit Cookie pattern for CSRF protection
 */

// Store for CSRF tokens (in production, use Redis)
const csrfTokens = new Map();

/**
 * Generate CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create and set CSRF token
 */
export const csrfTokenGenerator = (req, res, next) => {
  // Generate token if doesn't exist
  if (!req.session?.csrfToken) {
    const token = generateCsrfToken();

    if (req.session) {
      req.session.csrfToken = token;
    }

    // Also set in cookie for double submit pattern
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    req.csrfToken = token;
  } else {
    req.csrfToken = req.session.csrfToken;
  }

  // Add method to get token
  req.csrfToken = function () {
    return req.session?.csrfToken || req.cookies['XSRF-TOKEN'];
  };

  next();
};

/**
 * Verify CSRF token
 */
export const csrfProtection = (req, res, next) => {
  // Skip CSRF check for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const bodyToken = req.body?._csrf;
  const token = headerToken || bodyToken;

  // Get session token
  const sessionToken = req.session?.csrfToken;
  const cookieToken = req.cookies['XSRF-TOKEN'];

  // Verify token exists
  if (!token) {
    logSecurityEvent('CSRF_TOKEN_MISSING', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.userId,
    });

    throw ApiError.forbidden('CSRF token missing');
  }

  // Verify token matches (double submit cookie pattern)
  if (token !== sessionToken && token !== cookieToken) {
    logSecurityEvent('CSRF_TOKEN_INVALID', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.userId,
    });

    throw ApiError.forbidden('Invalid CSRF token');
  }

  next();
};

/**
 * CSRF protection for specific routes
 */
export const csrfProtect = () => {
  return [csrfTokenGenerator, csrfProtection];
};

/**
 * Get CSRF token endpoint helper
 */
export const getCsrfToken = (req, res) => {
  res.success({
    csrfToken: req.csrfToken?.() || req.session?.csrfToken,
  }, 'CSRF token retrieved');
};

/**
 * Conditional CSRF protection
 * Only applies to non-API requests
 */
export const conditionalCsrfProtection = (req, res, next) => {
  // Skip for API requests (using JWT)
  if (req.path.startsWith('/api/')) {
    return next();
  }

  return csrfProtection(req, res, next);
};

export default {
  csrfTokenGenerator,
  csrfProtection,
  csrfProtect,
  getCsrfToken,
  conditionalCsrfProtection,
};
