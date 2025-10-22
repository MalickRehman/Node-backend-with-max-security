import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/**
 * Audit Controller
 * Handles audit log HTTP requests
 */

class AuditController {
  /**
   * Get all audit logs
   * GET /api/v1/audit/logs
   */
  static async getAllLogs(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const skip = (page - 1) * limit;
      const event = req.query.event;
      const severity = req.query.severity;

      const query = {};
      if (event) {
        query.event = event;
      }
      if (severity) {
        query.severity = severity;
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip);

      const total = await AuditLog.countDocuments(query);

      return res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get all logs controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to fetch audit logs',
      });
    }
  }

  /**
   * Get audit logs for a specific user
   * GET /api/v1/audit/logs/:userId
   */
  static async getUserLogs(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const event = req.query.event;

      const result = await AuditLog.getUserActivity(userId, { limit, offset: (page - 1) * limit, event });

      return res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get user logs controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to fetch user audit logs',
      });
    }
  }

  /**
   * Get security events
   * GET /api/v1/audit/security-events
   */
  static async getSecurityEvents(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 100;
      const severity = req.query.severity;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      const result = await AuditLog.getSecurityEvents({
        limit,
        offset: (page - 1) * limit,
        severity,
        startDate,
        endDate,
      });

      return res.status(200).json({
        success: true,
        data: {
          events: result.logs,
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get security events controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to fetch security events',
      });
    }
  }

  /**
   * Get audit statistics
   * GET /api/v1/audit/statistics
   */
  static async getStatistics(req, res) {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      const stats = await AuditLog.getStatistics(startDate, endDate);

      return res.status(200).json({
        success: true,
        data: {
          statistics: stats,
        },
      });
    } catch (error) {
      logger.error('Get audit statistics controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to fetch audit statistics',
      });
    }
  }

  /**
   * Export audit logs
   * GET /api/v1/audit/export
   */
  static async exportLogs(req, res) {
    try {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      const format = req.query.format || 'json'; // json or csv

      const query = {};
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate);
        }
      }

      const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(10000); // Max 10k records

      if (format === 'csv') {
        // Convert to CSV
        const csv = convertToCSV(logs);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
        return res.send(csv);
      }

      // Default: JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.json`);
      return res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        count: logs.length,
        data: logs,
      });
    } catch (error) {
      logger.error('Export logs controller error:', error);

      return res.status(400).json({
        success: false,
        message: 'Failed to export audit logs',
      });
    }
  }
}

/**
 * Helper function to convert JSON to CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  const headers = ['timestamp', 'event', 'userId', 'username', 'email', 'ip', 'severity', 'message'];
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header] || '';
      // Escape commas and quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export default AuditController;
