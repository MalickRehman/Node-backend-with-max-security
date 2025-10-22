import User from '../models/User.mongoose.js';
import AuditLog from '../models/AuditLog.js';
import TokenService from './tokenService.js';
import logger, { logSecurityEvent } from '../utils/logger.js';

/**
 * Authentication Service
 * Handles user registration, login, logout, and token refresh
 */

class AuthService {
  /**
   * Register a new user
   */
  static async register(userData) {
    try {
      // Validate password strength
      const passwordValidation = User.validatePasswordStrength(userData.password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Create user
      const user = new User({
        email: userData.email,
        username: userData.username,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user', // Default to 'user' role
      });
      await user.save();

      // Log security event
      logSecurityEvent('USER_REGISTERED', {
        userId: user.id,
        email: user.email,
        username: user.username,
      });

      // Generate tokens
      const tokens = TokenService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info(`User registered successfully: ${user.email}`);

      return {
        user: user.toJSON(),
        tokens,
      };
    } catch (error) {
      logger.error('Registration error:', error.message);
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(credentials, ipAddress, userAgent) {
    try {
      const { email, password } = credentials;
      // Find user by email
      const user = await User.findByEmail(email);

      if (!user) {
        logSecurityEvent('LOGIN_FAILED', {
          email,
          reason: 'User not found',
          ipAddress,
          userAgent,
        });
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.isLocked()) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
        logSecurityEvent('LOGIN_FAILED', {
          userId: user.id,
          email,
          reason: 'Account locked',
          ipAddress,
          userAgent,
        });
        throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
      }

      // Check if account is active
      if (!user.isActive) {
        logSecurityEvent('LOGIN_FAILED', {
          userId: user.id,
          email,
          reason: 'Account inactive',
          ipAddress,
          userAgent,
        });
        throw new Error('Account is inactive. Please contact support.');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        await user.incLoginAttempts();
        logSecurityEvent('LOGIN_FAILED', {
          userId: user.id,
          email,
          reason: 'Invalid password',
          attempts: user.loginAttempts,
          ipAddress,
          userAgent,
        });
        throw new Error('Invalid credentials');
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate tokens
      const tokens = TokenService.generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logSecurityEvent('LOGIN_SUCCESS', {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
      });

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        user: user.toJSON(),
        tokens,
      };
    } catch (error) {
      logger.error('Login error:', error.message);
      throw error;
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  static async logout(userId, tokenId) {
    try {
      // Revoke the specific refresh token
      const revoked = TokenService.revokeRefreshToken(tokenId);

      if (revoked) {
        logSecurityEvent('LOGOUT', {
          userId,
          tokenId,
        });
        logger.info(`User logged out successfully: ${userId}`);
        return { success: true, message: 'Logged out successfully' };
      } else {
        throw new Error('Invalid token');
      }
    } catch (error) {
      logger.error('Logout error:', error.message);
      throw error;
    }
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  static async logoutAll(userId) {
    try {
      const count = TokenService.revokeAllUserTokens(userId);

      logSecurityEvent('LOGOUT_ALL', {
        userId,
        tokensRevoked: count,
      });

      logger.info(`User logged out from all devices: ${userId}`);

      return {
        success: true,
        message: `Logged out from ${count} device(s)`,
        count,
      };
    } catch (error) {
      logger.error('Logout all error:', error.message);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken) {
    try {
      const result = await TokenService.refreshAccessToken(refreshToken);

      logger.info('Access token refreshed successfully');

      return result;
    } catch (error) {
      logger.error('Token refresh error:', error.message);
      throw error;
    }
  }

  /**
   * Rotate refresh token (more secure)
   */
  static async rotateToken(refreshToken) {
    try {
      const tokens = await TokenService.rotateRefreshToken(refreshToken);

      logger.info('Refresh token rotated successfully');

      return tokens;
    } catch (error) {
      logger.error('Token rotation error:', error.message);
      throw error;
    }
  }

  /**
   * Verify user email (placeholder)
   */
  static async verifyEmail(userId, verificationToken) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Update user
      await User.update(userId, { isEmailVerified: true });

      logSecurityEvent('EMAIL_VERIFIED', {
        userId,
        email: user.email,
      });

      logger.info(`Email verified for user: ${user.email}`);

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      logger.error('Email verification error:', error.message);
      throw error;
    }
  }

  /**
   * Request password reset (placeholder)
   */
  static async requestPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);

      if (!user) {
        // Don't reveal if user exists
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        return {
          success: true,
          message: 'If email exists, password reset link has been sent',
        };
      }

      // In production, generate reset token and send email
      // const resetToken = generateResetToken();
      // await sendPasswordResetEmail(user.email, resetToken);

      logSecurityEvent('PASSWORD_RESET_REQUESTED', {
        userId: user.id,
        email: user.email,
      });

      logger.info(`Password reset requested for: ${user.email}`);

      return {
        success: true,
        message: 'If email exists, password reset link has been sent',
      };
    } catch (error) {
      logger.error('Password reset request error:', error.message);
      throw error;
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(resetToken, newPassword) {
    try {
      // Validate password strength
      const passwordValidation = User.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // In production: verify reset token and get user
      // const userId = await verifyResetToken(resetToken);
      // For demo, we'll assume token validation happened
      const userId = null; // Replace with actual user ID from token

      if (userId) {
        // Check if password was used before
        const user = await User.findById(userId);
        if (user) {
          const isInHistory = await user.isPasswordInHistory(newPassword);
          if (isInHistory) {
            throw new Error('Cannot reuse any of your last 5 passwords');
          }

          // Update password
          user.password = newPassword;
          await user.save();

          // Revoke all existing tokens
          TokenService.revokeAllUserTokens(userId);

          logSecurityEvent('PASSWORD_RESET', {
            userId,
            email: user.email,
          });

          logger.info(`Password reset successfully for user: ${user.email}`);
        }
      }

      return { success: true, message: 'Password reset successfully. Please login with your new password.' };
    } catch (error) {
      logger.error('Password reset error:', error.message);
      throw error;
    }
  }

  /**
   * Change password (authenticated user)
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        logSecurityEvent('PASSWORD_CHANGE_FAILED', {
          userId,
          reason: 'Invalid current password',
        });
        throw new Error('Current password is incorrect');
      }

      // Validate new password strength
      const passwordValidation = User.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '));
      }

      // Check if password was used before
      const isInHistory = await user.isPasswordInHistory(newPassword);
      if (isInHistory) {
        throw new Error('Cannot reuse previous passwords');
      }

      // Update password
      await User.update(userId, { password: newPassword });

      // Revoke all existing refresh tokens (force re-login)
      TokenService.revokeAllUserTokens(userId);

      logSecurityEvent('PASSWORD_CHANGED', {
        userId,
        email: user.email,
      });

      logger.info(`Password changed for user: ${user.email}`);

      return { success: true, message: 'Password changed successfully. Please login again.' };
    } catch (error) {
      logger.error('Password change error:', error.message);
      throw error;
    }
  }

  /**
   * Get user's active sessions
   */
  static async getActiveSessions(userId) {
    try {
      const tokens = TokenService.getUserRefreshTokens(userId);

      return {
        sessions: tokens,
        count: tokens.length,
      };
    } catch (error) {
      logger.error('Get sessions error:', error.message);
      throw error;
    }
  }
}

export default AuthService;
