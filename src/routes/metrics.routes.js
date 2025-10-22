import express from 'express';
import metricsService from '../services/metricsService.js';
import { authenticate } from '../middleware/authentication.js';
import { authorize } from '../middleware/authorization.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Application metrics endpoints
 */

/**
 * @swagger
 * /api/v1/metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.error(500, 'Failed to retrieve metrics');
  }
});

/**
 * @swagger
 * /api/v1/metrics/json:
 *   get:
 *     summary: Get metrics in JSON format
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics in JSON format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/json', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const metrics = await metricsService.getMetricsJSON();
    res.success(metrics);
  } catch (error) {
    res.error(500, 'Failed to retrieve metrics');
  }
});

export default router;
