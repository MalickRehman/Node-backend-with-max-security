import winston from 'winston';
import config from '../config/environment.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  // Add stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += `\n${JSON.stringify(metadata, null, 2)}`;
  }

  return msg;
});

// Sanitize sensitive data from logs
const sanitize = winston.format((info) => {
  const sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
  ];

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();

      // Check if field is sensitive
      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeObject(sanitized[key]);
      }
    }

    return sanitized;
  };

  return sanitizeObject(info);
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sanitize(),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),

    // Error log file
    new winston.transports.File({
      filename: `${config.logging.filePath}/error.log`,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
      filename: `${config.logging.filePath}/combined.log`,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// Security event logger
export const securityLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), sanitize(), winston.format.json()),
  transports: [
    new winston.transports.File({
      filename: `${config.logging.filePath}/security.log`,
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Log security events
export const logSecurityEvent = (event, details = {}) => {
  securityLogger.info({
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

export default logger;
