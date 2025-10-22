import AuthService from '../services/authService.js';
import logger from '../utils/logger.js';

/**
 * Authentication Controller
 * Handles auth-related HTTP requests
 */

class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  static async register(req, res) {
    try {
      const { email, username, password, firstName, lastName } = req.body;

      const result = await AuthService.register({
        email,
        username,
        password,
        firstName,
        lastName,
      });

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
      });
    } catch (error) {
      logger.error('Register controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Registration failed',
      });
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      console.log({ email });
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');
      const result = await AuthService.login({ email, password }, ipAddress, userAgent);

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
      });
    } catch (error) {
      logger.error('Login controller error:', error);

      return res.status(401).json({
        success: false,
        message: error.message || 'Login failed',
      });
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  static async logout(req, res) {
    try {
      const userId = req.userId;
      const tokenId = req.tokenId;

      await AuthService.logout(userId, tokenId);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Logout failed',
      });
    }
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout-all
   */
  static async logoutAll(req, res) {
    try {
      const userId = req.userId;

      const result = await AuthService.logoutAll(userId);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          devicesLoggedOut: result.count,
        },
      });
    } catch (error) {
      logger.error('Logout all controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Logout failed',
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  static async refreshToken(req, res) {
    try {
      const refreshToken = req.refreshToken;

      const result = await AuthService.refreshToken(refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      logger.error('Refresh token controller error:', error);

      // Clear invalid refresh token
      res.clearCookie('refreshToken');

      return res.status(401).json({
        success: false,
        message: error.message || 'Token refresh failed',
      });
    }
  }

  /**
   * Rotate refresh token (more secure)
   * POST /api/v1/auth/rotate
   */
  static async rotateToken(req, res) {
    try {
      const refreshToken = req.refreshToken;

      const result = await AuthService.rotateToken(refreshToken);

      // Set new refresh token in httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.status(200).json({
        success: true,
        message: 'Token rotated successfully',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      logger.error('Rotate token controller error:', error);

      // Clear invalid refresh token
      res.clearCookie('refreshToken');

      return res.status(401).json({
        success: false,
        message: error.message || 'Token rotation failed',
      });
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  static async getCurrentUser(req, res) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      logger.error('Get current user controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to get user information',
      });
    }
  }

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  static async changePassword(req, res) {
    try {
      const userId = req.userId;
      const { currentPassword, newPassword } = req.body;

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      // Clear refresh token cookie (user needs to login again)
      res.clearCookie('refreshToken');

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Change password controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Password change failed',
      });
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const result = await AuthService.requestPasswordReset(email);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Forgot password controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Password reset request failed',
      });
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;

      const result = await AuthService.resetPassword(resetToken, newPassword);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Reset password controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Password reset failed',
      });
    }
  }

  /**
   * Verify email
   * POST /api/v1/auth/verify-email
   */
  static async verifyEmail(req, res) {
    try {
      const userId = req.userId;
      const { verificationToken } = req.body;

      const result = await AuthService.verifyEmail(userId, verificationToken);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Verify email controller error:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Email verification failed',
      });
    }
  }

  /**
   * Get active sessions
   * GET /api/v1/auth/sessions
   */
  static async getActiveSessions(req, res) {
    try {
      const userId = req.userId;

      const result = await AuthService.getActiveSessions(userId);

      return res.status(200).json({
        success: true,
        data: {
          sessions: result.sessions,
          count: result.count,
        },
      });
    } catch (error) {
      logger.error('Get sessions controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to get sessions',
      });
    }
  }
}

export default AuthController;
