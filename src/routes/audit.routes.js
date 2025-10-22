import express from 'express';
import AuditController from '../controllers/auditController.js';
import { authenticate } from '../middleware/authentication.js';
import { isAdmin, requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

/**
 * @swagger
 * /audit/logs:
 *   get:
 *     summary: Get all audit logs
 *     description: Retrieve paginated audit logs with filtering options (Admin only)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Logs per page
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type (LOGIN, LOGOUT, 2FA_ENABLED, etc.)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs until this date
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           ipAddress:
 *                             type: string
 *                           userAgent:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Requires audit:list permission
 */
router.get('/logs', authenticate, requirePermission(PERMISSIONS.AUDIT_LIST), validatePagination, AuditController.getAllLogs);

/**
 * @swagger
 * /audit/logs/{userId}:
 *   get:
 *     summary: Get user audit logs
 *     description: Get audit logs for a specific user (Admin only)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User audit logs retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Requires audit:read permission
 *       404:
 *         description: User not found
 */
router.get('/logs/:userId', authenticate, requirePermission(PERMISSIONS.AUDIT_READ), AuditController.getUserLogs);

/**
 * @swagger
 * /audit/security-events:
 *   get:
 *     summary: Get security events
 *     description: Retrieve security-related events (failed logins, 2FA changes, etc.)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: Security events retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Requires audit:list permission
 */
router.get('/security-events', authenticate, requirePermission(PERMISSIONS.AUDIT_LIST), AuditController.getSecurityEvents);

/**
 * @swagger
 * /audit/statistics:
 *   get:
 *     summary: Get audit statistics
 *     description: Get statistical overview of audit logs (Admin only)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                     totalSecurityEvents:
 *                       type: integer
 *                     failedLogins:
 *                       type: integer
 *                     successfulLogins:
 *                       type: integer
 *                     eventsByType:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/statistics', authenticate, isAdmin, AuditController.getStatistics);

/**
 * @swagger
 * /audit/export:
 *   get:
 *     summary: Export audit logs
 *     description: Export audit logs in CSV or JSON format (Admin only)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for export
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for export
 *     responses:
 *       200:
 *         description: Audit logs exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: array
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Requires audit:export permission
 */
router.get('/export', authenticate, requirePermission(PERMISSIONS.AUDIT_EXPORT), AuditController.exportLogs);

export default router;
