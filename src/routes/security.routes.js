import express from 'express';
import SecurityController from '../controllers/securityController.js';
import { authenticate } from '../middleware/authentication.js';
import { isAdmin } from '../middleware/authorization.js';

const router = express.Router();

/**
 * @swagger
 * /security/dashboard:
 *   get:
 *     summary: Get security dashboard
 *     description: Get comprehensive security dashboard with statistics and metrics (Admin only)
 *     tags: [Security Monitoring]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Security dashboard retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     failedLogins:
 *                       type: integer
 *                     blockedIPs:
 *                       type: integer
 *                     securityAlerts:
 *                       type: integer
 *                     recentEvents:
 *                       type: array
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/dashboard', authenticate, isAdmin, SecurityController.getDashboard);

/**
 * @swagger
 * /security/alerts:
 *   get:
 *     summary: Get security alerts
 *     description: Get real-time security alerts and warnings (Admin only)
 *     tags: [Security Monitoring]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved, ignored]
 *         description: Filter by alert status
 *     responses:
 *       200:
 *         description: Security alerts retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/alerts', authenticate, isAdmin, SecurityController.getAlerts);

/**
 * @swagger
 * /security/trends:
 *   get:
 *     summary: Get security trends
 *     description: Get security trends and analytics over time (Admin only)
 *     tags: [Security Monitoring]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 90d]
 *           default: 7d
 *         description: Time period for trends
 *     responses:
 *       200:
 *         description: Security trends retrieved successfully
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
 *                     loginTrends:
 *                       type: array
 *                     securityEventsTrends:
 *                       type: array
 *                     failedLoginsTrends:
 *                       type: array
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/trends', authenticate, isAdmin, SecurityController.getTrends);

/**
 * @swagger
 * /security/ip/{ip}:
 *   get:
 *     summary: Get IP information
 *     description: Get detailed information and statistics for a specific IP address (Admin only)
 *     tags: [Security Monitoring]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *         description: IP address
 *         example: 192.168.1.1
 *     responses:
 *       200:
 *         description: IP information retrieved successfully
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
 *                     ipAddress:
 *                       type: string
 *                     isBlocked:
 *                       type: boolean
 *                     totalRequests:
 *                       type: integer
 *                     failedAttempts:
 *                       type: integer
 *                     lastSeen:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/ip/:ip', authenticate, isAdmin, SecurityController.getIPInfo);

/**
 * @swagger
 * /security/ip/block:
 *   post:
 *     summary: Block IP address
 *     description: Block a specific IP address from accessing the system (Admin only)
 *     tags: [Security Monitoring]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipAddress
 *             properties:
 *               ipAddress:
 *                 type: string
 *                 example: 192.168.1.1
 *               reason:
 *                 type: string
 *                 example: Suspicious activity detected
 *               duration:
 *                 type: string
 *                 enum: [1h, 24h, 7d, permanent]
 *                 default: permanent
 *     responses:
 *       200:
 *         description: IP address blocked successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/ip/block', authenticate, isAdmin, SecurityController.blockIPAddress);

/**
 * @swagger
 * /security/ip/unblock:
 *   post:
 *     summary: Unblock IP address
 *     description: Unblock a previously blocked IP address (Admin only)
 *     tags: [Security Monitoring]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipAddress
 *             properties:
 *               ipAddress:
 *                 type: string
 *                 example: 192.168.1.1
 *     responses:
 *       200:
 *         description: IP address unblocked successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/ip/unblock', authenticate, isAdmin, SecurityController.unblockIPAddress);

/**
 * @swagger
 * /security/user/{userId}:
 *   get:
 *     summary: Get user security profile
 *     description: Get comprehensive security profile for a specific user (Admin only)
 *     tags: [Security Monitoring]
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
 *         description: User security profile retrieved successfully
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
 *                     userId:
 *                       type: string
 *                     twoFactorEnabled:
 *                       type: boolean
 *                     lastLogin:
 *                       type: string
 *                       format: date-time
 *                     failedLoginAttempts:
 *                       type: integer
 *                     isLocked:
 *                       type: boolean
 *                     passwordLastChanged:
 *                       type: string
 *                       format: date-time
 *                     activeSessions:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.get('/user/:userId', authenticate, isAdmin, SecurityController.getUserSecurityProfile);

export default router;
