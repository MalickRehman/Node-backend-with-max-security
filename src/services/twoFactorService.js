import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import config from '../config/environment.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';
import emailService from './emailService.js';
import whatsappService from './whatsappService.js';

/**
 * Two-Factor Authentication Service
 * Supports multiple 2FA methods: TOTP (Authenticator App), Email, WhatsApp
 */

class TwoFactorService {
  constructor() {
    this.redisClient = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.redisClient = getRedisClient();
      logger.info('✅ Two-Factor service initialized');
    } catch (error) {
      logger.error('Failed to initialize Two-Factor service:', error);
    }
  }

  /**
   * Generate TOTP secret for authenticator apps (legacy static method)
   */
  static generateSecret(userEmail, username) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${config.app.name} (${username})`,
        issuer: config.app.name,
        length: 32,
      });

      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Generate TOTP secret for authenticator apps
   */
  generateTOTPSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: `${config.twoFactor.appName} (${userEmail})`,
      issuer: config.twoFactor.issuer,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  /**
   * Generate QR code for TOTP setup (legacy static method)
   */
  static async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code for TOTP setup
   */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify TOTP token (legacy static method)
   */
  static verifyToken(secret, token) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      return verified;
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      return false;
    }
  }

  /**
   * Verify TOTP token from authenticator app
   */
  verifyTOTPToken(secret, token) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2, // Allow 2 time steps before/after
      });

      return verified;
    } catch (error) {
      logger.error('Failed to verify TOTP token:', error);
      return false;
    }
  }

  /**
   * Generate random 6-digit verification code
   */
  generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Send verification code via email
   */
  async sendEmailVerificationCode(email, userName, userId) {
    try {
      const code = this.generateVerificationCode();
      const expiresIn = 600; // 10 minutes

      // Store code in Redis
      const redisKey = `2fa:email:${userId}`;
      await this.redisClient.setEx(redisKey, expiresIn, code);

      // Send email
      await emailService.send2FACode(email, code, userName);

      logger.info(`Email 2FA code sent to ${email}`);

      return {
        success: true,
        expiresIn,
        message: 'Verification code sent to your email',
      };
    } catch (error) {
      logger.error('Failed to send email verification code:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Send verification code via WhatsApp
   */
  async sendWhatsAppVerificationCode(phoneNumber, userName, userId) {
    try {
      // Validate phone number
      if (!whatsappService.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      const code = this.generateVerificationCode();
      const expiresIn = 600; // 10 minutes

      // Store code in Redis
      const redisKey = `2fa:whatsapp:${userId}`;
      await this.redisClient.setEx(redisKey, expiresIn, code);

      // Send WhatsApp message
      await whatsappService.send2FACode(phoneNumber, code, userName);

      logger.info(`WhatsApp 2FA code sent to ${phoneNumber}`);

      return {
        success: true,
        expiresIn,
        message: 'Verification code sent to your WhatsApp',
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp verification code:', error);
      throw new Error('Failed to send verification code via WhatsApp');
    }
  }

  /**
   * Verify email verification code
   */
  async verifyEmailCode(userId, code) {
    try {
      const redisKey = `2fa:email:${userId}`;
      const storedCode = await this.redisClient.get(redisKey);

      if (!storedCode) {
        return {
          verified: false,
          message: 'Code expired or not found',
        };
      }

      if (storedCode !== code) {
        // Track failed attempts
        await this.trackFailedAttempt(userId, 'email');
        return {
          verified: false,
          message: 'Invalid verification code',
        };
      }

      // Delete code after successful verification
      await this.redisClient.del(redisKey);

      logger.info(`Email 2FA verified for user ${userId}`);

      return {
        verified: true,
        message: 'Verification successful',
      };
    } catch (error) {
      logger.error('Failed to verify email code:', error);
      throw new Error('Verification failed');
    }
  }

  /**
   * Verify WhatsApp verification code
   */
  async verifyWhatsAppCode(userId, code) {
    try {
      const redisKey = `2fa:whatsapp:${userId}`;
      const storedCode = await this.redisClient.get(redisKey);

      if (!storedCode) {
        return {
          verified: false,
          message: 'Code expired or not found',
        };
      }

      if (storedCode !== code) {
        // Track failed attempts
        await this.trackFailedAttempt(userId, 'whatsapp');
        return {
          verified: false,
          message: 'Invalid verification code',
        };
      }

      // Delete code after successful verification
      await this.redisClient.del(redisKey);

      logger.info(`WhatsApp 2FA verified for user ${userId}`);

      return {
        verified: true,
        message: 'Verification successful',
      };
    } catch (error) {
      logger.error('Failed to verify WhatsApp code:', error);
      throw new Error('Verification failed');
    }
  }

  /**
   * Track failed 2FA attempts
   */
  async trackFailedAttempt(userId, method) {
    try {
      const redisKey = `2fa:failed:${userId}:${method}`;
      const attempts = await this.redisClient.incr(redisKey);

      // Set expiry on first attempt
      if (attempts === 1) {
        await this.redisClient.expire(redisKey, 3600); // 1 hour
      }

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        logger.warn(`Too many failed 2FA attempts for user ${userId} via ${method}`);
        return {
          locked: true,
          attempts,
        };
      }

      return {
        locked: false,
        attempts,
      };
    } catch (error) {
      logger.error('Failed to track failed attempt:', error);
      return { locked: false, attempts: 0 };
    }
  }

  /**
   * Check if user is locked due to too many failed attempts
   */
  async isUserLocked(userId, method) {
    try {
      const redisKey = `2fa:failed:${userId}:${method}`;
      const attempts = await this.redisClient.get(redisKey);

      return attempts >= 5;
    } catch (error) {
      logger.error('Failed to check user lock status:', error);
      return false;
    }
  }

  /**
   * Reset failed attempt counter
   */
  async resetFailedAttempts(userId, method) {
    try {
      const redisKey = `2fa:failed:${userId}:${method}`;
      await this.redisClient.del(redisKey);
      logger.info(`Reset failed 2FA attempts for user ${userId} (${method})`);
    } catch (error) {
      logger.error('Failed to reset failed attempts:', error);
    }
  }

  /**
   * Generate backup codes (legacy static method)
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Generate backup codes for account recovery
   */
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup code for storage
   */
  hashBackupCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verify backup code (legacy static method)
   */
  static verifyBackupCode(backupCodes, code) {
    if (!backupCodes || !Array.isArray(backupCodes)) {
      return false;
    }

    const index = backupCodes.indexOf(code.toUpperCase());
    return index !== -1 ? index : false;
  }

  /**
   * Verify backup code
   */
  verifyBackupCodeHash(code, hashedCodes) {
    const hashedInput = this.hashBackupCode(code);
    return hashedCodes.includes(hashedInput);
  }

  /**
   * Enable 2FA (legacy static method)
   */
  static async enable(user, token) {
    try {
      const isValid = this.verifyToken(user.twoFactorSecret, token);

      if (!isValid) {
        throw new Error('Invalid verification code');
      }

      const backupCodes = this.generateBackupCodes();

      return {
        success: true,
        backupCodes,
      };
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  /**
   * Disable 2FA (legacy static method)
   */
  static async disable(user, password) {
    try {
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      return {
        success: true,
        message: '2FA has been disabled',
      };
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }
}

// Export singleton instance
const twoFactorService = new TwoFactorService();
export default twoFactorService;
