import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
// import mongoSanitize from 'express-mongo-sanitize'; // Commented out - has compatibility issues with Express 5
// import xss from 'xss-clean'; // Commented out - deprecated package
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import config from './config/environment.js';
import logger from './utils/logger.js';
import { connectDB } from './config/database.js';
import { createRedisClient, closeRedisConnection } from './config/redis.js';
import { responseHandler, responseTime } from './middleware/responseHandler.js';
import {
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
} from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import auditRoutes from './routes/audit.routes.js';
import securityRoutes from './routes/security.routes.js';
import oauthRoutes from './routes/oauth.routes.js';
import adminSecurityRoutes from './routes/adminSecurity.routes.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';

// Passport configuration
import passport from './config/passport.js';

// Swagger Configuration
import swaggerConfig from './config/swagger.js';

// Monitoring configuration
import {
  initializeSentry,
  getSentryRequestHandler,
  getSentryTracingHandler,
  getSentryErrorHandler,
} from './config/monitoring.js';
import metricsMiddleware from './middleware/metricsMiddleware.js';

const app = express();

// Initialize Sentry monitoring
initializeSentry(app);

// Trust proxy - important for rate limiting and security headers behind reverse proxy
app.set('trust proxy', 1);

// Sentry request handler (must be first middleware)
app.use(getSentryRequestHandler());

// Sentry tracing handler
app.use(getSentryTracingHandler());

// Metrics collection middleware
app.use(metricsMiddleware);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: config.security.hstsMaxAge,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Add server's own origin for Swagger UI
      const allowedOrigins = [
        ...config.cors.origin,
        `http://${config.host}:${config.port}`,
        `http://localhost:${config.port}`,
      ];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
    maxAge: 600, // 10 minutes
  })
);

// Body Parsing Middleware
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie Parser
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Compression
app.use(compression());

// Data Sanitization against NoSQL Injection
// Note: express-mongo-sanitize has compatibility issues with Express 5
// Using custom sanitization in validation middleware instead

// Data Sanitization against XSS
// Note: xss-clean is deprecated
// Using helmet CSP and input validation instead

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
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
});

app.use(limiter);

// Request ID middleware for tracking
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Response time tracking
app.use(responseTime);

// Response handler helpers
app.use(responseHandler);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      requestId: req.id,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: config.app.version,
  });
});

// Setup Swagger UI - register before other routes
swaggerConfig.setupSwagger(app);

// API Root
app.get(config.app.apiPrefix, (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to ${config.app.name}`,
    version: config.app.version,
    documentation: `${config.app.apiPrefix}/docs`,
    endpoints: {
      auth: `${config.app.apiPrefix}/auth`,
      users: `${config.app.apiPrefix}/users`,
      audit: `${config.app.apiPrefix}/audit`,
      security: `${config.app.apiPrefix}/security`,
    },
  });
});

// Mount routes
app.use(`${config.app.apiPrefix}/health`, healthRoutes);
app.use(`${config.app.apiPrefix}/metrics`, metricsRoutes);
app.use(`${config.app.apiPrefix}/auth`, authRoutes);
app.use(`${config.app.apiPrefix}/auth`, oauthRoutes); // OAuth routes under /auth
app.use(`${config.app.apiPrefix}/users`, userRoutes);
app.use(`${config.app.apiPrefix}/audit`, auditRoutes);
app.use(`${config.app.apiPrefix}/security`, securityRoutes);
app.use(`${config.app.apiPrefix}/admin/security`, adminSecurityRoutes);

// 404 Not Found Handler
app.use(notFoundHandler);

// Sentry Error Handler (must be before other error handlers)
app.use(getSentryErrorHandler());

// Global Error Handler (must be last)
app.use(errorHandler);

// Connect to MongoDB and Start Server
const PORT = config.port;
const HOST = config.host;

let server;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis (optional - app will work without it)
    await createRedisClient();

    // Start Express server
    server = app.listen(PORT, HOST, () => {
      logger.info(`
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║  ${config.app.name.padEnd(52)}║
    ║  Version: ${config.app.version.padEnd(45)}║
    ║  Environment: ${config.nodeEnv.padEnd(41)}║
    ║  Server: http://${HOST}:${PORT.toString().padEnd(37)}║
    ║  API: http://${HOST}:${PORT}${config.app.apiPrefix.padEnd(31)}║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
  `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close Redis connection
    await closeRedisConnection();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  handleUnhandledRejection(reason, promise);
  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  handleUncaughtException(error);
  // Don't call gracefulShutdown as handleUncaughtException exits process
});

export default app;
