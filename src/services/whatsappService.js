import twilio from 'twilio';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * WhatsApp Service
 * Handles WhatsApp messaging via Twilio for 2FA
 */

class WhatsAppService {
  constructor() {
    this.client = null;
    this.fromNumber = null;
    this.initialize();
  }

  /**
   * Initialize Twilio client
   */
  initialize() {
    if (!config.twilio?.accountSid || !config.twilio?.authToken) {
      logger.warn('⚠️  Twilio not configured. WhatsApp services disabled.');
      return;
    }

    try {
      this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
      this.fromNumber = config.twilio.whatsappNumber || config.twilio.phoneNumber;

      if (!this.fromNumber) {
        logger.warn('⚠️  Twilio phone number not configured.');
        return;
      }

      logger.info('✅ WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service:', error);
    }
  }

  /**
   * Format phone number for WhatsApp (must include country code)
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return `whatsapp:${cleaned}`;
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(to, message) {
    if (!this.client) {
      throw new Error('WhatsApp service not configured');
    }

    try {
      const formattedTo = this.formatPhoneNumber(to);
      const formattedFrom = this.formatPhoneNumber(this.fromNumber);

      const result = await this.client.messages.create({
        from: formattedFrom,
        to: formattedTo,
        body: message,
      });

      logger.info(`WhatsApp message sent to ${to}: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send 2FA verification code via WhatsApp
   */
  async send2FACode(phoneNumber, code, userName) {
    const message = `
🔐 *${config.app.name} Security Code*

Hello ${userName || 'there'}!

Your verification code is:

*${code}*

This code will expire in *10 minutes*.

⚠️ *Security Warning*: Never share this code with anyone. Our team will never ask for this code.

If you didn't request this code, please contact support immediately.
    `.trim();

    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send login alert via WhatsApp
   */
  async sendLoginAlert(phoneNumber, userName, location, device) {
    const message = `
🔔 *${config.app.name} Security Alert*

Hello ${userName}!

A new login to your account was detected:

📍 Location: ${location || 'Unknown'}
📱 Device: ${device || 'Unknown'}
⏰ Time: ${new Date().toLocaleString()}

If this was you, no action is needed.

If you don't recognize this activity, secure your account immediately:
1. Change your password
2. Review active sessions
3. Enable 2FA if not already enabled

Need help? Contact our support team.
    `.trim();

    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send account security notification
   */
  async sendSecurityNotification(phoneNumber, userName, event) {
    const message = `
⚠️ *${config.app.name} Security Alert*

Hello ${userName}!

Important security event on your account:

${event}

Time: ${new Date().toLocaleString()}

If you didn't authorize this action, please secure your account immediately.

Contact support if you need assistance.
    `.trim();

    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Send welcome message
   */
  async sendWelcomeMessage(phoneNumber, userName) {
    const message = `
👋 *Welcome to ${config.app.name}!*

Hello ${userName}!

Thank you for joining us! Your account has been successfully created.

For your security, we recommend:
✅ Enable two-factor authentication
✅ Use a strong, unique password
✅ Review your security settings

Need help getting started? Our support team is here for you.

Enjoy using ${config.app.name}!
    `.trim();

    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * Verify phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic validation - must have country code and be 10-15 digits
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService;
