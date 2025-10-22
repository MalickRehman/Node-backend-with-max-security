import validator from 'validator';
import { logSecurityEvent } from '../utils/logger.js';

/**
 * Request Sanitization Middleware
 * Sanitizes and validates input to prevent injection attacks
 */

/**
 * Sanitize string value
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  // Escape HTML
  let sanitized = validator.escape(value);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Sanitize NoSQL injection patterns
 */
const sanitizeNoSQL = (value) => {
  if (typeof value === 'string') {
    // Remove MongoDB operators
    return value.replace(/^\$/, '').replace(/\./g, '');
  }

  if (typeof value === 'object' && value !== null) {
    const sanitized = Array.isArray(value) ? [] : {};

    for (const key in value) {
      // Remove keys starting with $
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeNoSQL(value[key]);
      }
    }

    return sanitized;
  }

  return value;
};

/**
 * Sanitize SQL injection patterns
 */
const sanitizeSQL = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove common SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(--|\#|\/\*|\*\/)/g,  // SQL comments
    /('|('')|;|\\)/g,  // SQL special characters
  ];

  let sanitized = value;
  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
};

/**
 * Detect XSS patterns
 */
const detectXSS = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,  // Event handlers
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(value));
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj, options = {}) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const { skipFields = [], xssOnly = false } = options;
  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    // Skip specified fields
    if (skipFields.includes(key)) {
      sanitized[key] = obj[key];
      continue;
    }

    const value = obj[key];

    if (typeof value === 'string') {
      if (xssOnly) {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = sanitizeSQL(sanitizeNoSQL(sanitizeString(value)));
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, options);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Request body sanitization middleware
 */
export const sanitizeBody = (options = {}) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, options);
    }
    next();
  };
};

/**
 * Query parameters sanitization middleware
 */
export const sanitizeQuery = (options = {}) => {
  return (req, res, next) => {
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, options);
    }
    next();
  };
};

/**
 * URL parameters sanitization middleware
 */
export const sanitizeParams = (options = {}) => {
  return (req, res, next) => {
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, options);
    }
    next();
  };
};

/**
 * Sanitize all request inputs
 */
export const sanitizeAll = (options = {}) => {
  return (req, res, next) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, options);
    }

    // Sanitize query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, options);
    }

    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, options);
    }

    next();
  };
};

/**
 * XSS detection middleware
 */
export const detectXSSAttack = (req, res, next) => {
  const checkForXSS = (obj, path = '') => {
    for (const key in obj) {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string' && detectXSS(value)) {
        logSecurityEvent('XSS_ATTACK_DETECTED', {
          path: currentPath,
          value: value.substring(0, 100),
          ip: req.ip,
          userId: req.userId,
          url: req.url,
          method: req.method,
        });

        return true;
      }

      if (typeof value === 'object' && value !== null) {
        if (checkForXSS(value, currentPath)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check body
  if (req.body && checkForXSS(req.body, 'body')) {
    return res.error(400, 'Potential XSS attack detected');
  }

  // Check query
  if (req.query && checkForXSS(req.query, 'query')) {
    return res.error(400, 'Potential XSS attack detected');
  }

  next();
};

/**
 * SQL injection detection middleware
 */
export const detectSQLInjection = (req, res, next) => {
  const checkForSQL = (obj, path = '') => {
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
      'ALTER', 'EXEC', 'EXECUTE', 'UNION', 'WHERE', 'OR', 'AND',
    ];

    for (const key in obj) {
      const value = obj[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        const upperValue = value.toUpperCase();
        if (sqlKeywords.some((keyword) => upperValue.includes(keyword))) {
          logSecurityEvent('SQL_INJECTION_DETECTED', {
            path: currentPath,
            value: value.substring(0, 100),
            ip: req.ip,
            userId: req.userId,
            url: req.url,
            method: req.method,
          });

          return true;
        }
      }

      if (typeof value === 'object' && value !== null) {
        if (checkForSQL(value, currentPath)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check body
  if (req.body && checkForSQL(req.body, 'body')) {
    return res.error(400, 'Potential SQL injection detected');
  }

  // Check query
  if (req.query && checkForSQL(req.query, 'query')) {
    return res.error(400, 'Potential SQL injection detected');
  }

  next();
};

/**
 * NoSQL injection detection middleware
 */
export const detectNoSQLInjection = (req, res, next) => {
  const checkForNoSQL = (obj, path = '') => {
    for (const key in obj) {
      if (key.startsWith('$')) {
        logSecurityEvent('NOSQL_INJECTION_DETECTED', {
          path,
          key,
          ip: req.ip,
          userId: req.userId,
          url: req.url,
          method: req.method,
        });

        return true;
      }

      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        const currentPath = path ? `${path}.${key}` : key;
        if (checkForNoSQL(value, currentPath)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check body
  if (req.body && checkForNoSQL(req.body, 'body')) {
    return res.error(400, 'Potential NoSQL injection detected');
  }

  // Check query
  if (req.query && checkForNoSQL(req.query, 'query')) {
    return res.error(400, 'Potential NoSQL injection detected');
  }

  next();
};

export default {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeAll,
  detectXSSAttack,
  detectSQLInjection,
  detectNoSQLInjection,
  sanitizeString,
  sanitizeNoSQL,
  sanitizeSQL,
};
