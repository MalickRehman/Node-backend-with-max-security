import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './environment.js';
import logger from '../utils/logger.js';

let cachedSwaggerSpec = null;

const getSwaggerOptions = () => {
  return {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Nexus UI Backend API',
        version: config.app.version,
        description: 'A comprehensive, production-ready Node.js backend with every possible security feature implemented.',
        contact: {
          name: 'API Support',
          email: 'support@nexusui.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: `http://${config.host}:${config.port}${config.app.apiPrefix}`,
          description: 'Development server',
        },
        {
          url: `https://api.nexusui.com${config.app.apiPrefix}`,
          description: 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your access token',
          },
        },
        schemas: {
          User: {
            type: 'object',
            properties: {
              _id: { type: 'string', description: 'User ID' },
              email: { type: 'string', format: 'email', description: 'User email address' },
              username: { type: 'string', description: 'Username' },
              firstName: { type: 'string', description: 'First name' },
              lastName: { type: 'string', description: 'Last name' },
              role: { type: 'string', enum: ['guest', 'user', 'moderator', 'admin'], description: 'User role' },
              isActive: { type: 'boolean', description: 'Account status' },
              isEmailVerified: { type: 'boolean', description: 'Email verification status' },
              twoFactorEnabled: { type: 'boolean', description: '2FA enabled status' },
              lastLogin: { type: 'string', format: 'date-time', description: 'Last login timestamp' },
              createdAt: { type: 'string', format: 'date-time', description: 'Account creation timestamp' },
              updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
            },
          },
          Error: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', description: 'Error message' },
            },
          },
        },
        responses: {
          UnauthorizedError: {
            description: 'Access token is missing or invalid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { success: false, message: 'Access token required' },
              },
            },
          },
          ValidationError: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { success: false, message: 'Validation failed' },
              },
            },
          },
          RateLimitError: {
            description: 'Too many requests',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { success: false, message: 'Too many requests, please try again later' },
              },
            },
          },
        },
      },
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization endpoints' },
        { name: 'Two-Factor Authentication', description: 'Multi-method 2FA endpoints (TOTP, Email, WhatsApp)' },
        { name: 'OAuth', description: 'OAuth 2.0 social login endpoints (Google, GitHub)' },
        { name: 'Users', description: 'User management endpoints' },
        { name: 'Audit Logs', description: 'Security audit log endpoints' },
        { name: 'Security Monitoring', description: 'Security monitoring and analytics endpoints' },
        { name: 'Admin Security', description: 'Admin security management and password policy endpoints' },
      ],
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js', './src/models/*.js'],
  };
};

export const getSwaggerSpec = () => {
  if (config.nodeEnv === 'production' && cachedSwaggerSpec) {
    return cachedSwaggerSpec;
  }

  const options = getSwaggerOptions();
  const swaggerSpec = swaggerJsdoc(options);

  if (config.nodeEnv === 'production') {
    cachedSwaggerSpec = swaggerSpec;
  }

  return swaggerSpec;
};

export const setupSwagger = (app) => {
  try {
    const swaggerSpec = getSwaggerSpec();

    logger.info('Setting up Swagger documentation');

    // Swagger JSON endpoint
    app.get(`${config.app.apiPrefix}/docs.json`, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Swagger UI
    app.use(
      `${config.app.apiPrefix}/docs`,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Nexus UI Backend API',
        explorer: true,
      })
    );

    logger.info(`✅ Swagger UI available at ${config.app.apiPrefix}/docs`);
    logger.info(`✅ Swagger JSON available at ${config.app.apiPrefix}/docs.json`);
  } catch (error) {
    logger.error('Error setting up Swagger:', error);
  }
};

export default { getSwaggerSpec, setupSwagger };
