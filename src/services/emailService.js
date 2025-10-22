import nodemailer from 'nodemailer';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Email Service
 * Handles all email communications including 2FA codes
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    if (!config.email?.smtp?.host) {
      logger.warn('⚠️  SMTP not configured. Email services disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.auth.user,
          pass: config.email.smtp.auth.pass,
        },
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email service verification failed:', error);
        } else {
          logger.info('✅ Email service initialized successfully');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Send email
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.email.from || `"${config.app.name}" <noreply@example.com>`,
        to,
        subject,
        html,
        text,
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send 2FA verification code via email
   */
  async send2FACode(email, code, userName) {
    const subject = `Your ${config.app.name} Verification Code`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code-box { background: white; border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${config.app.name}</h1>
      <p>Two-Factor Authentication</p>
    </div>
    <div class="content">
      <p>Hello ${userName || 'there'},</p>
      <p>You requested a verification code to complete your login. Please use the code below:</p>

      <div class="code-box">
        <div class="code">${code}</div>
      </div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>

      <div class="warning">
        <strong>⚠️ Security Notice:</strong><br>
        If you didn't request this code, please ignore this email and secure your account immediately.
        Never share this code with anyone.
      </div>

      <p>Best regards,<br>
      The ${config.app.name} Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} ${config.app.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Your ${config.app.name} Verification Code

Hello ${userName || 'there'},

You requested a verification code to complete your login.

Your verification code is: ${code}

This code will expire in 10 minutes.

Security Notice: If you didn't request this code, please ignore this email and secure your account immediately. Never share this code with anyone.

Best regards,
The ${config.app.name} Team

This is an automated message. Please do not reply to this email.
    `;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, userName) {
    const subject = `Welcome to ${config.app.name}!`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f9fafb; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${config.app.name}!</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>Thank you for creating an account with us! We're excited to have you on board.</p>
      <p>To get started, we recommend enabling two-factor authentication for enhanced security.</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The ${config.app.name} Team</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `Welcome to ${config.app.name}!\n\nHello ${userName},\n\nThank you for creating an account with us!`;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${config.app.baseUrl}/reset-password?token=${resetToken}`;
    const subject = `Reset Your ${config.app.name} Password`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f9fafb; }
    .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
    .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <div class="warning">
        <strong>⚠️ Security Notice:</strong><br>
        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      </div>
      <p>Best regards,<br>The ${config.app.name} Team</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `Password Reset Request\n\nHello ${userName},\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;

    return await this.sendEmail({ to: email, subject, html, text });
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;
