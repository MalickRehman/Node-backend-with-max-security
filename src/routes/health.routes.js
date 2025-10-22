import express from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis.js';
import config from '../config/environment.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Application health and status endpoints
 */

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   example: 2024-10-20T12:00:00.000Z
 */
router.get('/', (req, res) => {
  res.success({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     summary: Detailed health check with dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                 uptime:
 *                   type: number
 *                 services:
 *                   type: object
 *                 system:
 *                   type: object
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: config.app.version,
      services: {},
      system: {
        memory: {
          total: process.memoryUsage().heapTotal,
          used: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
        },
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    // Check MongoDB
    try {
      const mongoState = mongoose.connection.readyState;
      const mongoStatus =
        mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

      healthStatus.services.mongodb = {
        status: mongoStatus,
        healthy: mongoState === 1,
        host: config.database.mongodb.host,
        database: config.database.mongodb.name,
      };

      if (mongoStatus !== 'connected') {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.services.mongodb = {
        status: 'error',
        healthy: false,
        error: error.message,
      };
      healthStatus.status = 'degraded';
    }

    // Check Redis
    try {
      const redisClient = getRedisClient();
      const redisPing = await redisClient.ping();

      healthStatus.services.redis = {
        status: redisPing === 'PONG' ? 'connected' : 'error',
        healthy: redisPing === 'PONG',
        host: config.redis.host,
        port: config.redis.port,
      };

      if (redisPing !== 'PONG') {
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.services.redis = {
        status: 'error',
        healthy: false,
        error: error.message,
      };
      healthStatus.status = 'degraded';
    }

    // Overall status code
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness probe for Kubernetes/Docker
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if MongoDB is connected
    const mongoReady = mongoose.connection.readyState === 1;

    // Check if Redis is connected
    let redisReady = false;
    try {
      const redisClient = getRedisClient();
      const redisPing = await redisClient.ping();
      redisReady = redisPing === 'PONG';
    } catch (error) {
      redisReady = false;
    }

    const isReady = mongoReady && redisReady;

    if (isReady) {
      res.success({
        ready: true,
        services: {
          mongodb: mongoReady,
          redis: redisReady,
        },
      });
    } else {
      res.status(503).json({
        ready: false,
        services: {
          mongodb: mongoReady,
          redis: redisReady,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Liveness probe for Kubernetes/Docker
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req, res) => {
  res.success({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
