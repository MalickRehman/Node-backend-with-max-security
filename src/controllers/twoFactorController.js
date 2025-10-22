import User from '../models/User.mongoose.js';
import TwoFactorService from '../services/twoFactorService.js';
import twoFactorService from '../services/twoFactorService.js';
import logger, { logSecurityEvent } from '../utils/logger.js';

/**
 * Two-Factor Authentication Controller
 */

class TwoFactorController {
  /**
   * Setup 2FA - Generate secret and QR code
   * POST /api/v1/auth/2fa/setup
   */
  static async setup(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is already enabled for this account',
        });
      }

      // Generate secret
      const { secret, otpauthUrl } = TwoFactorService.generateSecret(user.email, user.username);

      // Generate QR code
      const qrCode = await TwoFactorService.generateQRCode(otpauthUrl);

      // Save secret (but don't enable yet)
      user.twoFactorSecret = secret;
      await user.save();

      logSecurityEvent('2FA_SETUP_INITIATED', {
        userId: user.id,
        email: user.email,
      });

      logger.info(`2FA setup initiated for user: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: '2FA setup initiated. Scan QR code with your authenticator app.',
        data: {
          secret,
          qrCode,
        },
      });
    } catch (error) {
      logger.error('2FA setup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to setup 2FA',
      });
    }
  }

  /**
   * Enable 2FA - Verify token and enable
   * POST /api/v1/auth/2fa/enable
   */
  static async enable(req, res) {
    try {
      const userId = req.userId;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required',
        });
      }

      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is already enabled',
        });
      }

      if (!user.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: 'Please setup 2FA first',
        });
      }

      // Verify token
      const isValid = TwoFactorService.verifyToken(user.twoFactorSecret, token);

      if (!isValid) {
        logSecurityEvent('2FA_ENABLE_FAILED', {
          userId: user.id,
          reason: 'Invalid token',
        });

        return res.status(400).json({
          success: false,
          message: 'Invalid verification code',
        });
      }

      // Generate backup codes
      const backupCodes = TwoFactorService.generateBackupCodes();

      // Enable 2FA
      user.twoFactorEnabled = true;
      user.twoFactorBackupCodes = backupCodes;
      await user.save();

      logSecurityEvent('2FA_ENABLED', {
        userId: user.id,
        email: user.email,
      });

      logger.info(`2FA enabled for user: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: '2FA has been enabled successfully',
        data: {
          backupCodes,
        },
      });
    } catch (error) {
      logger.error('2FA enable error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to enable 2FA',
      });
    }
  }

  /**
   * Disable 2FA
   * POST /api/v1/auth/2fa/disable
   */
  static async disable(req, res) {
    try {
      const userId = req.userId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required',
        });
      }

      const user = await User.findById(userId).select(
        '+password +twoFactorSecret +twoFactorBackupCodes'
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled',
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        logSecurityEvent('2FA_DISABLE_FAILED', {
          userId: user.id,
          reason: 'Invalid password',
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid password',
        });
      }

      // Disable 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorBackupCodes = [];
      await user.save();

      logSecurityEvent('2FA_DISABLED', {
        userId: user.id,
        email: user.email,
      });

      logger.info(`2FA disabled for user: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: '2FA has been disabled',
      });
    } catch (error) {
      logger.error('2FA disable error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA',
      });
    }
  }

  /**
   * Verify 2FA token during login
   * POST /api/v1/auth/2fa/verify
   */
  static async verify(req, res) {
    try {
      const { token, backupCode } = req.body;
      const userId = req.session?.pendingUserId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'No pending 2FA verification',
        });
      }

      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');

      if (!user || !user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification request',
        });
      }

      let isValid = false;

      // Verify token or backup code
      if (token) {
        isValid = TwoFactorService.verifyToken(user.twoFactorSecret, token);
      } else if (backupCode) {
        const codeIndex = TwoFactorService.verifyBackupCode(user.twoFactorBackupCodes, backupCode);
        if (codeIndex !== false) {
          isValid = true;
          // Remove used backup code
          user.twoFactorBackupCodes.splice(codeIndex, 1);
          await user.save();

          logSecurityEvent('2FA_BACKUP_CODE_USED', {
            userId: user.id,
            remainingCodes: user.twoFactorBackupCodes.length,
          });
        }
      }

      if (!isValid) {
        logSecurityEvent('2FA_VERIFICATION_FAILED', {
          userId: user.id,
          method: token ? 'token' : 'backupCode',
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid verification code',
        });
      }

      // Clear pending verification
      delete req.session.pendingUserId;

      logSecurityEvent('2FA_VERIFICATION_SUCCESS', {
        userId: user.id,
        email: user.email,
      });

      return res.status(200).json({
        success: true,
        message: '2FA verification successful',
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      logger.error('2FA verify error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify 2FA',
      });
    }
  }

  /**
   * Get 2FA status
   * GET /api/v1/auth/2fa/status
   */
  static async getStatus(req, res) {
    try {
      const userId = req.userId;
      const user = await User.findById(userId).select('+twoFactorBackupCodes');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          enabled: user.twoFactorEnabled,
          backupCodesRemaining: user.twoFactorBackupCodes?.length || 0,
        },
      });
    } catch (error) {
      logger.error('Get 2FA status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get 2FA status',
      });
    }
  }

  /**
   * Send Email 2FA Code
   * POST /api/v1/auth/2fa/email/send
   */
  static async sendEmailCode(req, res) {
    try {
      const { email, userId } = req.body;

      if (!email || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Email and userId are required',
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Send verification code
      const result = await twoFactorService.sendEmailVerificationCode(
        email,
        user.username || user.firstName || 'User',
        userId
      );

      logSecurityEvent('2FA_EMAIL_CODE_SENT', {
        userId,
        email,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Send email 2FA code error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code',
      });
    }
  }

  /**
   * Verify Email 2FA Code
   * POST /api/v1/auth/2fa/email/verify
   */
  static async verifyEmailCode(req, res) {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({
          success: false,
          message: 'UserId and code are required',
        });
      }

      // Check if user is locked
      const isLocked = await twoFactorService.isUserLocked(userId, 'email');
      if (isLocked) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Account temporarily locked.',
        });
      }

      // Verify code
      const result = await twoFactorService.verifyEmailCode(userId, code);

      if (result.verified) {
        // Reset failed attempts on success
        await twoFactorService.resetFailedAttempts(userId, 'email');

        logSecurityEvent('2FA_EMAIL_VERIFIED', {
          userId,
        });
      }

      return res.status(result.verified ? 200 : 400).json({
        success: result.verified,
        ...result,
      });
    } catch (error) {
      logger.error('Verify email 2FA code error:', error);
      return res.status(500).json({
        success: false,
        message: 'Verification failed',
      });
    }
  }

  /**
   * Send WhatsApp 2FA Code
   * POST /api/v1/auth/2fa/whatsapp/send
   */
  static async sendWhatsAppCode(req, res) {
    try {
      const { phoneNumber, userId } = req.body;

      if (!phoneNumber || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and userId are required',
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Send verification code
      const result = await twoFactorService.sendWhatsAppVerificationCode(
        phoneNumber,
        user.username || user.firstName || 'User',
        userId
      );

      logSecurityEvent('2FA_WHATSAPP_CODE_SENT', {
        userId,
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Send WhatsApp 2FA code error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send verification code',
      });
    }
  }

  /**
   * Verify WhatsApp 2FA Code
   * POST /api/v1/auth/2fa/whatsapp/verify
   */
  static async verifyWhatsAppCode(req, res) {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({
          success: false,
          message: 'UserId and code are required',
        });
      }

      // Check if user is locked
      const isLocked = await twoFactorService.isUserLocked(userId, 'whatsapp');
      if (isLocked) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Account temporarily locked.',
        });
      }

      // Verify code
      const result = await twoFactorService.verifyWhatsAppCode(userId, code);

      if (result.verified) {
        // Reset failed attempts on success
        await twoFactorService.resetFailedAttempts(userId, 'whatsapp');

        logSecurityEvent('2FA_WHATSAPP_VERIFIED', {
          userId,
        });
      }

      return res.status(result.verified ? 200 : 400).json({
        success: result.verified,
        ...result,
      });
    } catch (error) {
      logger.error('Verify WhatsApp 2FA code error:', error);
      return res.status(500).json({
        success: false,
        message: 'Verification failed',
      });
    }
  }
}

export default TwoFactorController;
