import User from '../models/User.mongoose.js';
import logger, { logSecurityEvent } from '../utils/logger.js';
import TokenService from '../services/tokenService.js';

/**
 * Admin Security Controller
 * Manages security policies and user security settings
 */

class AdminSecurityController {
  /**
   * Get user's password history
   * GET /api/v1/admin/security/users/:userId/password-history
   */
  static async getPasswordHistory(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('+passwordHistory');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Don't return actual hashes, just metadata
      const historyMetadata = {
        count: user.passwordHistory?.length || 0,
        lastPasswordChange: user.lastPasswordChange,
        maxHistorySize: 5,
      };

      logSecurityEvent('PASSWORD_HISTORY_VIEWED', {
        adminId: req.userId,
        targetUserId: userId,
      });

      return res.status(200).json({
        success: true,
        data: historyMetadata,
      });
    } catch (error) {
      logger.error('Get password history error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve password history',
      });
    }
  }

  /**
   * Force password change for a user
   * POST /api/v1/admin/security/users/:userId/force-password-change
   */
  static async forcePasswordChange(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Mark user as requiring password change
      user.requirePasswordChange = true;
      await user.save();

      // Revoke all user's tokens to force re-login
      TokenService.revokeAllUserTokens(userId);

      logSecurityEvent('FORCE_PASSWORD_CHANGE', {
        adminId: req.userId,
        targetUserId: userId,
        targetEmail: user.email,
      });

      logger.info(`Admin ${req.userId} forced password change for user ${userId}`);

      return res.status(200).json({
        success: true,
        message: 'User will be required to change password on next login',
      });
    } catch (error) {
      logger.error('Force password change error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to force password change',
      });
    }
  }

  /**
   * Unlock a locked user account
   * POST /api/v1/admin/security/users/:userId/unlock
   */
  static async unlockAccount(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.isLocked()) {
        return res.status(400).json({
          success: false,
          message: 'Account is not locked',
        });
      }

      // Reset lock
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save();

      logSecurityEvent('ACCOUNT_UNLOCKED', {
        adminId: req.userId,
        targetUserId: userId,
        targetEmail: user.email,
      });

      logger.info(`Admin ${req.userId} unlocked account for user ${userId}`);

      return res.status(200).json({
        success: true,
        message: 'Account unlocked successfully',
      });
    } catch (error) {
      logger.error('Unlock account error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to unlock account',
      });
    }
  }

  /**
   * Get user security summary
   * GET /api/v1/admin/security/users/:userId/summary
   */
  static async getUserSecuritySummary(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('+passwordHistory');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const activeSessions = TokenService.getUserRefreshTokens(userId);

      const summary = {
        userId: user._id,
        email: user.email,
        username: user.username,
        isActive: user.isActive,
        isLocked: user.isLocked(),
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        loginAttempts: user.loginAttempts,
        lockUntil: user.lockUntil,
        lastLogin: user.lastLogin,
        lastPasswordChange: user.lastPasswordChange,
        passwordHistoryCount: user.passwordHistory?.length || 0,
        activeSessions: activeSessions.length,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      };

      logSecurityEvent('SECURITY_SUMMARY_VIEWED', {
        adminId: req.userId,
        targetUserId: userId,
      });

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Get security summary error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve security summary',
      });
    }
  }

  /**
   * Revoke all sessions for a user
   * POST /api/v1/admin/security/users/:userId/revoke-sessions
   */
  static async revokeAllSessions(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const count = TokenService.revokeAllUserTokens(userId);

      logSecurityEvent('SESSIONS_REVOKED_BY_ADMIN', {
        adminId: req.userId,
        targetUserId: userId,
        targetEmail: user.email,
        sessionsRevoked: count,
      });

      logger.info(`Admin ${req.userId} revoked ${count} sessions for user ${userId}`);

      return res.status(200).json({
        success: true,
        message: `Revoked ${count} session(s)`,
        data: {
          sessionsRevoked: count,
        },
      });
    } catch (error) {
      logger.error('Revoke sessions error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to revoke sessions',
      });
    }
  }

  /**
   * Get password policy configuration
   * GET /api/v1/admin/security/password-policy
   */
  static async getPasswordPolicy(req, res) {
    try {
      const policy = {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        historyCount: 5,
        expirationDays: null, // null = no expiration
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
      };

      return res.status(200).json({
        success: true,
        data: policy,
      });
    } catch (error) {
      logger.error('Get password policy error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve password policy',
      });
    }
  }

  /**
   * Get security statistics
   * GET /api/v1/admin/security/stats
   */
  static async getSecurityStats(req, res) {
    try {
      const [totalUsers, lockedAccounts, unverifiedEmails, oauthUsers] = await Promise.all([
        User.countDocuments({ isActive: true }),
        User.countDocuments({ lockUntil: { $gt: Date.now() } }),
        User.countDocuments({ isEmailVerified: false }),
        User.countDocuments({ authProvider: { $ne: 'local' } }),
      ]);

      const stats = {
        totalActiveUsers: totalUsers,
        lockedAccounts,
        unverifiedEmails,
        oauthUsers,
        localUsers: totalUsers - oauthUsers,
        timestamp: new Date().toISOString(),
      };

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get security stats error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve security statistics',
      });
    }
  }

  /**
   * Bulk unlock accounts
   * POST /api/v1/admin/security/bulk-unlock
   */
  static async bulkUnlockAccounts(req, res) {
    try {
      const result = await User.updateMany(
        { lockUntil: { $gt: Date.now() } },
        {
          $set: {
            loginAttempts: 0,
            lockUntil: null,
          },
        }
      );

      logSecurityEvent('BULK_ACCOUNT_UNLOCK', {
        adminId: req.userId,
        accountsUnlocked: result.modifiedCount,
      });

      logger.info(`Admin ${req.userId} unlocked ${result.modifiedCount} accounts`);

      return res.status(200).json({
        success: true,
        message: `Unlocked ${result.modifiedCount} account(s)`,
        data: {
          accountsUnlocked: result.modifiedCount,
        },
      });
    } catch (error) {
      logger.error('Bulk unlock error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to unlock accounts',
      });
    }
  }
}

export default AdminSecurityController;
