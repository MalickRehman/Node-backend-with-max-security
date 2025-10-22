import express from 'express';
import rateLimit from 'express-rate-limit';
import AuthController from '../controllers/authController.js';
import TwoFactorController from '../controllers/twoFactorController.js';
import { authenticate, verifyRefreshToken } from '../middleware/authentication.js';
import {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateEmail,
  validateResetPassword,
} from '../middleware/validation.js';
import config from '../config/environment.js';

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.loginMax, // 5 requests per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: 'Too many accounts created from this IP, please try again later',
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email, username, and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass@123
 *                 description: Must contain uppercase, lowercase, number, and special character
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/register', registerLimiter, validateRegister, AuthController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email/username and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailOrUsername
 *               - password
 *             properties:
 *               emailOrUsername:
 *                 type: string
 *                 example: user@example.com
 *                 description: Email address or username
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass@123
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                     requires2FA:
 *                       type: boolean
 *                       example: false
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/login', authLimiter, validateLogin, AuthController.login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (revoke refresh token)
 * @access  Private
 */
router.post('/logout', verifyRefreshToken, AuthController.logout);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', authenticate, AuthController.logoutAll);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post('/refresh', verifyRefreshToken, AuthController.refreshToken);

/**
 * @route   POST /api/v1/auth/rotate
 * @desc    Rotate refresh token (more secure)
 * @access  Public (requires refresh token)
 */
router.post('/rotate', verifyRefreshToken, AuthController.rotateToken);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, AuthController.getCurrentUser);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated user)
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validateChangePassword,
  AuthController.changePassword
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', authLimiter, validateEmail, AuthController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', authLimiter, validateResetPassword, AuthController.resetPassword);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Private
 */
router.post('/verify-email', authenticate, AuthController.verifyEmail);

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', authenticate, AuthController.getActiveSessions);

/**
 * @swagger
 * /auth/2fa/setup:
 *   post:
 *     summary: Setup TOTP 2FA
 *     description: Generate secret key and QR code for authenticator app (Google Authenticator, Authy, etc.)
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup data generated successfully
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
 *                     secret:
 *                       type: string
 *                       example: JBSWY3DPEHPK3PXP
 *                       description: Secret key for manual entry
 *                     qrCode:
 *                       type: string
 *                       example: data:image/png;base64,iVBORw0KG...
 *                       description: QR code image in base64 format
 *                     backupCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2"]
 *                       description: One-time use backup codes (10 total)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post('/2fa/setup', authenticate, TwoFactorController.setup);

/**
 * @swagger
 * /auth/2fa/enable:
 *   post:
 *     summary: Enable TOTP 2FA
 *     description: Verify and enable 2FA after scanning QR code with authenticator app
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *                 description: 6-digit code from authenticator app
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
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
 *                   example: Two-factor authentication enabled successfully
 *       400:
 *         description: Invalid token
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post('/2fa/enable', authenticate, TwoFactorController.enable);

/**
 * @swagger
 * /auth/2fa/disable:
 *   post:
 *     summary: Disable TOTP 2FA
 *     description: Disable two-factor authentication (requires password confirmation)
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass@123
 *                 description: User's account password for verification
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
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
 *                   example: Two-factor authentication disabled successfully
 *       400:
 *         description: Invalid password
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.post('/2fa/disable', authenticate, TwoFactorController.disable);

/**
 * @swagger
 * /auth/2fa/verify:
 *   post:
 *     summary: Verify TOTP 2FA token
 *     description: Verify 2FA token from authenticator app during login or use backup code
 *     tags: [Two-Factor Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *                 description: User ID from login response
 *               token:
 *                 type: string
 *                 example: "123456"
 *                 description: 6-digit code from authenticator app or 8-character backup code
 *     responses:
 *       200:
 *         description: Token verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 verified:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Two-factor authentication successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid or expired token
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/2fa/verify', TwoFactorController.verify);

/**
 * @swagger
 * /auth/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     description: Get current two-factor authentication status and configuration
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status retrieved successfully
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
 *                     enabled:
 *                       type: boolean
 *                       example: true
 *                       description: Whether 2FA is enabled
 *                     method:
 *                       type: string
 *                       enum: [totp, email, whatsapp]
 *                       example: totp
 *                       description: Active 2FA method
 *                     backupCodesRemaining:
 *                       type: number
 *                       example: 8
 *                       description: Number of unused backup codes (TOTP only)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get('/2fa/status', authenticate, TwoFactorController.getStatus);

/**
 * @swagger
 * /auth/2fa/email/send:
 *   post:
 *     summary: Send 2FA code via email
 *     description: Send a 6-digit verification code to user's email for 2FA
 *     tags: [Two-Factor Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - userId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Verification code sent successfully
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
 *                   example: Verification code sent to your email
 *                 expiresIn:
 *                   type: number
 *                   example: 600
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/2fa/email/send', authLimiter, TwoFactorController.sendEmailCode);

/**
 * @swagger
 * /auth/2fa/email/verify:
 *   post:
 *     summary: Verify email 2FA code
 *     description: Verify the 6-digit code sent via email
 *     tags: [Two-Factor Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - code
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Code verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 verified:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Verification successful
 *       400:
 *         description: Invalid or expired code
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/2fa/email/verify', authLimiter, TwoFactorController.verifyEmailCode);

/**
 * @swagger
 * /auth/2fa/whatsapp/send:
 *   post:
 *     summary: Send 2FA code via WhatsApp
 *     description: Send a 6-digit verification code to user's WhatsApp for 2FA
 *     tags: [Two-Factor Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - userId
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *                 description: Phone number with country code
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Verification code sent successfully
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
 *                   example: Verification code sent to your WhatsApp
 *                 expiresIn:
 *                   type: number
 *                   example: 600
 *       400:
 *         description: Invalid phone number or request
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/2fa/whatsapp/send', authLimiter, TwoFactorController.sendWhatsAppCode);

/**
 * @swagger
 * /auth/2fa/whatsapp/verify:
 *   post:
 *     summary: Verify WhatsApp 2FA code
 *     description: Verify the 6-digit code sent via WhatsApp
 *     tags: [Two-Factor Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - code
 *             properties:
 *               userId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Code verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 verified:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Verification successful
 *       400:
 *         description: Invalid or expired code
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/2fa/whatsapp/verify', authLimiter, TwoFactorController.verifyWhatsAppCode);

export default router;
