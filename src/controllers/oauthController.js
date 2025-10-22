import tokenService from '../services/tokenService.js';
import logger from '../utils/logger.js';
import config from '../config/environment.js';

class OAuthController {
  /**
   * Handle OAuth callback success
   * Generate tokens and redirect to frontend
   */
  static async handleOAuthSuccess(req, res) {
    try {
      const user = req.user;

      if (!user) {
        logger.warn('OAuth callback received without user data');
        return res.redirect(`${config.cors.origin[0]}/auth/error?message=Authentication failed`);
      }

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(user);
      const refreshToken = tokenService.generateRefreshToken(user);

      // Store refresh token
      await tokenService.storeRefreshToken(user._id, refreshToken);

      // Log successful OAuth login
      logger.info(`OAuth login successful for user: ${user.email}`);

      // Redirect to frontend with tokens
      // In production, you might want to use httpOnly cookies instead
      const redirectUrl = `${config.cors.origin[0]}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      logger.error('OAuth callback error:', error);
      return res.redirect(`${config.cors.origin[0]}/auth/error?message=Authentication failed`);
    }
  }

  /**
   * Handle OAuth failure
   */
  static handleOAuthFailure(req, res) {
    logger.warn('OAuth authentication failed');
    return res.redirect(`${config.cors.origin[0]}/auth/error?message=Authentication failed`);
  }

  /**
   * Unlink OAuth account
   */
  static async unlinkOAuth(req, res) {
    try {
      const { provider } = req.params;
      const user = req.user;

      if (!['google', 'github'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OAuth provider',
        });
      }

      // Check if user has a password (can't unlink if OAuth is only auth method)
      if (user.authProvider !== 'local' && !user.password) {
        return res.status(400).json({
          success: false,
          message: 'Cannot unlink OAuth account. Please set a password first.',
        });
      }

      // Unlink the provider
      if (provider === 'google' && user.oauth?.google?.id) {
        user.oauth.google = undefined;
      } else if (provider === 'github' && user.oauth?.github?.id) {
        user.oauth.github = undefined;
      } else {
        return res.status(400).json({
          success: false,
          message: `${provider} account is not linked`,
        });
      }

      await user.save();

      logger.info(`User ${user.email} unlinked ${provider} account`);

      return res.status(200).json({
        success: true,
        message: `${provider} account unlinked successfully`,
      });
    } catch (error) {
      logger.error('Unlink OAuth error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unlink OAuth account',
      });
    }
  }

  /**
   * Get linked OAuth accounts
   */
  static async getLinkedAccounts(req, res) {
    try {
      const user = req.user;

      const linkedAccounts = {
        google: !!user.oauth?.google?.id,
        github: !!user.oauth?.github?.id,
      };

      return res.status(200).json({
        success: true,
        data: {
          authProvider: user.authProvider,
          linkedAccounts,
        },
      });
    } catch (error) {
      logger.error('Get linked accounts error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch linked accounts',
      });
    }
  }
}

export default OAuthController;
