import express from 'express';
import AdminSecurityController from '../controllers/adminSecurityController.js';
import { authenticate } from '../middleware/authentication.js';
import { authorize } from '../middleware/authorization.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin Security
 *   description: Security management endpoints for administrators
 */

/**
 * @swagger
 * /api/v1/admin/security/users/{userId}/password-history:
 *   get:
 *     summary: Get user's password history metadata
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Password history metadata retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: User not found
 */
router.get(
  '/users/:userId/password-history',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.getPasswordHistory
);

/**
 * @swagger
 * /api/v1/admin/security/users/{userId}/force-password-change:
 *   post:
 *     summary: Force user to change password on next login
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Password change forced successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: User not found
 */
router.post(
  '/users/:userId/force-password-change',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.forcePasswordChange
);

/**
 * @swagger
 * /api/v1/admin/security/users/{userId}/unlock:
 *   post:
 *     summary: Unlock a locked user account
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Account unlocked successfully
 *       400:
 *         description: Account is not locked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: User not found
 */
router.post(
  '/users/:userId/unlock',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.unlockAccount
);

/**
 * @swagger
 * /api/v1/admin/security/users/{userId}/summary:
 *   get:
 *     summary: Get comprehensive security summary for a user
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Security summary retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: User not found
 */
router.get(
  '/users/:userId/summary',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.getUserSecuritySummary
);

/**
 * @swagger
 * /api/v1/admin/security/users/{userId}/revoke-sessions:
 *   post:
 *     summary: Revoke all active sessions for a user
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Sessions revoked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: User not found
 */
router.post(
  '/users/:userId/revoke-sessions',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.revokeAllSessions
);

/**
 * @swagger
 * /api/v1/admin/security/password-policy:
 *   get:
 *     summary: Get current password policy configuration
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password policy retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get(
  '/password-policy',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.getPasswordPolicy
);

/**
 * @swagger
 * /api/v1/admin/security/stats:
 *   get:
 *     summary: Get security statistics across all users
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security statistics retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.get(
  '/stats',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.getSecurityStats
);

/**
 * @swagger
 * /api/v1/admin/security/bulk-unlock:
 *   post:
 *     summary: Unlock all locked accounts
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts unlocked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 */
router.post(
  '/bulk-unlock',
  authenticate,
  authorize(['admin']),
  AdminSecurityController.bulkUnlockAccounts
);

export default router;
