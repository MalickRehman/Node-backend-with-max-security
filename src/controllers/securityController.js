import AuditLog from '../models/AuditLog.js';
import { getIPStats, blockIP, unblockIP } from '../middleware/ipSecurity.js';
import logger from '../utils/logger.js';

/**
 * Security Monitoring Controller
 * Provides security dashboard and monitoring endpoints
 */

class SecurityController {
  /**
   * Get security dashboard statistics
   * GET /api/v1/security/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get security events from last 24 hours
      const securityEvents24h = await AuditLog.find({
        event: {
          $in: [
            'LOGIN_FAILED',
            'IP_BLOCKED',
            'ACCOUNT_LOCKED',
            '2FA_VERIFICATION_FAILED',
            'INVALID_TOKEN',
            'PERMISSION_DENIED',
            'SUSPICIOUS_IP_ACTIVITY',
          ],
        },
        timestamp: { $gte: last24h },
      }).sort({ timestamp: -1 });

      // Get successful logins
      const successfulLogins24h = await AuditLog.countDocuments({
        event: 'LOGIN_SUCCESS',
        timestamp: { $gte: last24h },
      });

      // Get failed logins
      const failedLogins24h = await AuditLog.countDocuments({
        event: 'LOGIN_FAILED',
        timestamp: { $gte: last24h },
      });

      // Get account lockouts
      const accountLockouts24h = await AuditLog.countDocuments({
        event: 'ACCOUNT_LOCKED',
        timestamp: { $gte: last24h },
      });

      // Get blocked IPs
      const blockedIPs24h = await AuditLog.countDocuments({
        event: 'IP_BLOCKED',
        timestamp: { $gte: last24h },
      });

      // Get 2FA events
      const twoFactorEnabled24h = await AuditLog.countDocuments({
        event: '2FA_ENABLED',
        timestamp: { $gte: last24h },
      });

      const twoFactorFailed24h = await AuditLog.countDocuments({
        event: '2FA_VERIFICATION_FAILED',
        timestamp: { $gte: last24h },
      });

      // Get permission denials
      const permissionDenials24h = await AuditLog.countDocuments({
        event: 'PERMISSION_DENIED',
        timestamp: { $gte: last24h },
      });

      // Get suspicious activity
      const suspiciousActivity24h = await AuditLog.countDocuments({
        event: 'SUSPICIOUS_IP_ACTIVITY',
        timestamp: { $gte: last24h },
      });

      // Get top failed login IPs
      const topFailedIPs = await AuditLog.aggregate([
        {
          $match: {
            event: 'LOGIN_FAILED',
            timestamp: { $gte: last7d },
          },
        },
        {
          $group: {
            _id: '$ip',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      // Get hourly event distribution (last 24 hours)
      const hourlyDistribution = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: last24h },
          },
        },
        {
          $group: {
            _id: {
              hour: { $hour: '$timestamp' },
              event: '$event',
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.hour': 1 },
        },
      ]);

      // Get recent critical events
      const criticalEvents = await AuditLog.find({
        severity: { $in: ['high', 'critical'] },
        timestamp: { $gte: last24h },
      })
        .sort({ timestamp: -1 })
        .limit(50);

      // Calculate security score (0-100)
      const totalAttempts = successfulLogins24h + failedLogins24h;
      const failureRate = totalAttempts > 0 ? (failedLogins24h / totalAttempts) * 100 : 0;

      let securityScore = 100;
      securityScore -= failureRate * 0.5; // Penalize high failure rate
      securityScore -= accountLockouts24h * 2; // Penalize lockouts
      securityScore -= blockedIPs24h * 1; // Penalize blocked IPs
      securityScore -= suspiciousActivity24h * 3; // Heavily penalize suspicious activity
      securityScore = Math.max(0, Math.min(100, securityScore)); // Keep between 0-100

      return res.status(200).json({
        success: true,
        data: {
          securityScore: Math.round(securityScore),
          summary: {
            last24h: {
              successfulLogins: successfulLogins24h,
              failedLogins: failedLogins24h,
              accountLockouts: accountLockouts24h,
              blockedIPs: blockedIPs24h,
              twoFactorEnabled: twoFactorEnabled24h,
              twoFactorFailed: twoFactorFailed24h,
              permissionDenials: permissionDenials24h,
              suspiciousActivity: suspiciousActivity24h,
            },
          },
          topFailedIPs,
          hourlyDistribution,
          recentSecurityEvents: securityEvents24h.slice(0, 20),
          criticalEvents,
        },
      });
    } catch (error) {
      logger.error('Error getting security dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get security dashboard',
      });
    }
  }

  /**
   * Get real-time security alerts
   * GET /api/v1/security/alerts
   */
  static async getAlerts(req, res) {
    try {
      const { severity = 'all', limit = 50 } = req.query;

      const query = {
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      };

      if (severity !== 'all') {
        query.severity = severity;
      }

      const alerts = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
        },
      });
    } catch (error) {
      logger.error('Error getting security alerts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get security alerts',
      });
    }
  }

  /**
   * Get IP information and statistics
   * GET /api/v1/security/ip/:ip
   */
  static async getIPInfo(req, res) {
    try {
      const { ip } = req.params;

      const stats = await getIPStats(ip);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting IP info:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get IP information',
      });
    }
  }

  /**
   * Block an IP address manually
   * POST /api/v1/security/ip/block
   */
  static async blockIPAddress(req, res) {
    try {
      const { ip, reason } = req.body;

      if (!ip) {
        return res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
      }

      const result = blockIP(ip, reason || 'Manual block by admin');

      logger.info(`IP ${ip} blocked by admin ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error blocking IP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to block IP',
      });
    }
  }

  /**
   * Unblock an IP address
   * POST /api/v1/security/ip/unblock
   */
  static async unblockIPAddress(req, res) {
    try {
      const { ip } = req.body;

      if (!ip) {
        return res.status(400).json({
          success: false,
          message: 'IP address is required',
        });
      }

      const result = unblockIP(ip);

      logger.info(`IP ${ip} unblocked by admin ${req.userId}`);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Error unblocking IP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unblock IP',
      });
    }
  }

  /**
   * Get security trends over time
   * GET /api/v1/security/trends
   */
  static async getTrends(req, res) {
    try {
      const { days = 7 } = req.query;
      const daysInt = parseInt(days);
      const startDate = new Date(Date.now() - daysInt * 24 * 60 * 60 * 1000);

      // Get daily statistics
      const dailyStats = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              event: '$event',
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id.date': 1 },
        },
      ]);

      // Get event type distribution
      const eventDistribution = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$event',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      // Get severity distribution
      const severityDistribution = await AuditLog.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 },
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        data: {
          period: `${daysInt} days`,
          dailyStats,
          eventDistribution,
          severityDistribution,
        },
      });
    } catch (error) {
      logger.error('Error getting security trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get security trends',
      });
    }
  }

  /**
   * Get user security profile
   * GET /api/v1/security/user/:userId
   */
  static async getUserSecurityProfile(req, res) {
    try {
      const { userId } = req.params;

      // Get user's security events
      const events = await AuditLog.find({
        userId,
      })
        .sort({ timestamp: -1 })
        .limit(100);

      // Calculate statistics
      const failedLogins = events.filter(e => e.event === 'LOGIN_FAILED').length;
      const successfulLogins = events.filter(e => e.event === 'LOGIN_SUCCESS').length;
      const permissionDenials = events.filter(e => e.event === 'PERMISSION_DENIED').length;
      const twoFactorEnabled = events.some(e => e.event === '2FA_ENABLED');

      const lastLogin = events.find(e => e.event === 'LOGIN_SUCCESS');
      const lastFailedLogin = events.find(e => e.event === 'LOGIN_FAILED');

      return res.status(200).json({
        success: true,
        data: {
          userId,
          statistics: {
            failedLogins,
            successfulLogins,
            permissionDenials,
            twoFactorEnabled,
          },
          lastLogin: lastLogin?.timestamp,
          lastFailedLogin: lastFailedLogin?.timestamp,
          recentEvents: events.slice(0, 20),
        },
      });
    } catch (error) {
      logger.error('Error getting user security profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user security profile',
      });
    }
  }
}

export default SecurityController;
