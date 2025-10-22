import express from 'express';
import passport from '../config/passport.js';
import OAuthController from '../controllers/oauthController.js';
import { authenticate } from '../middleware/authentication.js';
import config from '../config/environment.js';

const router = express.Router();

// Only register OAuth routes if OAuth is enabled
if (config.features.enableOAuth) {
  /**
   * @swagger
   * /auth/google:
   *   get:
   *     summary: Initiate Google OAuth
   *     description: Redirects user to Google OAuth consent screen
   *     tags: [OAuth]
   *     responses:
   *       302:
   *         description: Redirect to Google OAuth
   */
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  /**
   * @swagger
   * /auth/google/callback:
   *   get:
   *     summary: Google OAuth callback
   *     description: Handles Google OAuth callback and generates JWT tokens
   *     tags: [OAuth]
   *     parameters:
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *         description: Authorization code from Google
   *     responses:
   *       302:
   *         description: Redirect to frontend with tokens
   */
  router.get(
    '/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/api/v1/auth/oauth/failure',
      session: false
    }),
    OAuthController.handleOAuthSuccess
  );

  /**
   * @swagger
   * /auth/github:
   *   get:
   *     summary: Initiate GitHub OAuth
   *     description: Redirects user to GitHub OAuth consent screen
   *     tags: [OAuth]
   *     responses:
   *       302:
   *         description: Redirect to GitHub OAuth
   */
  router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

  /**
   * @swagger
   * /auth/github/callback:
   *   get:
   *     summary: GitHub OAuth callback
   *     description: Handles GitHub OAuth callback and generates JWT tokens
   *     tags: [OAuth]
   *     parameters:
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *         description: Authorization code from GitHub
   *     responses:
   *       302:
   *         description: Redirect to frontend with tokens
   */
  router.get(
    '/github/callback',
    passport.authenticate('github', {
      failureRedirect: '/api/v1/auth/oauth/failure',
      session: false
    }),
    OAuthController.handleOAuthSuccess
  );

  /**
   * @swagger
   * /auth/oauth/failure:
   *   get:
   *     summary: OAuth failure handler
   *     description: Handles OAuth authentication failures
   *     tags: [OAuth]
   *     responses:
   *       302:
   *         description: Redirect to frontend with error
   */
  router.get('/oauth/failure', OAuthController.handleOAuthFailure);

  /**
   * @swagger
   * /auth/oauth/linked:
   *   get:
   *     summary: Get linked OAuth accounts
   *     description: Returns list of OAuth accounts linked to the user
   *     tags: [OAuth]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Linked accounts retrieved successfully
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
   *                     authProvider:
   *                       type: string
   *                       enum: [local, google, github]
   *                     linkedAccounts:
   *                       type: object
   *                       properties:
   *                         google:
   *                           type: boolean
   *                         github:
   *                           type: boolean
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.get('/oauth/linked', authenticate, OAuthController.getLinkedAccounts);

  /**
   * @swagger
   * /auth/oauth/unlink/{provider}:
   *   delete:
   *     summary: Unlink OAuth account
   *     description: Unlinks an OAuth provider from the user account
   *     tags: [OAuth]
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: provider
   *         required: true
   *         schema:
   *           type: string
   *           enum: [google, github]
   *         description: OAuth provider to unlink
   *     responses:
   *       200:
   *         description: OAuth account unlinked successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: google account unlinked successfully
   *       400:
   *         description: Invalid provider or cannot unlink
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.delete('/oauth/unlink/:provider', authenticate, OAuthController.unlinkOAuth);
}

export default router;
