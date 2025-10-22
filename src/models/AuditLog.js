import mongoose from 'mongoose';

/**
 * Audit Log Schema for MongoDB
 * Tracks all security-related events and user actions
 */

const auditLogSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true,
      enum: [
        // Authentication events
        'USER_REGISTERED',
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'LOGOUT_ALL',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET',
        'PASSWORD_RESET_REQUESTED',
        'EMAIL_VERIFIED',
        // Authorization events
        'AUTHORIZATION_FAILED',
        'UNAUTHORIZED_ACCESS',
        'PERMISSION_DENIED',
        // Security events
        'CSRF_TOKEN_MISSING',
        'CSRF_TOKEN_INVALID',
        'XSS_ATTACK_DETECTED',
        'SQL_INJECTION_DETECTED',
        'NOSQL_INJECTION_DETECTED',
        'FILE_UPLOAD_REJECTED',
        'RATE_LIMIT_EXCEEDED',
        'ROUTE_NOT_FOUND',
        // Token events
        'REFRESH_TOKEN_FAILED',
        'AUTHENTICATION_FAILED',
        // System events
        'UNHANDLED_REJECTION',
        'UNCAUGHT_EXCEPTION',
        // User actions
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'ROLE_CHANGED',
        'STATUS_CHANGED',
      ],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    username: {
      type: String,
    },
    email: {
      type: String,
    },
    ip: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
    },
    method: {
      type: String,
    },
    path: {
      type: String,
    },
    statusCode: {
      type: Number,
    },
    message: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // Using custom timestamp field
  }
);

// Compound indexes for common queries
auditLogSchema.index({ event: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

/**
 * Static Methods
 */

// Log security event
auditLogSchema.statics.logEvent = async function (event, details = {}) {
  try {
    const log = new this({
      event,
      ...details,
      timestamp: new Date(),
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - logging should not break the app
  }
};

// Get user activity
auditLogSchema.statics.getUserActivity = async function (userId, options = {}) {
  const { limit = 50, offset = 0, event } = options;

  const query = { userId };
  if (event) {
    query.event = event;
  }

  const logs = await this.find(query).sort({ timestamp: -1 }).limit(limit).skip(offset);

  const total = await this.countDocuments(query);

  return { logs, total, limit, offset };
};

// Get security events
auditLogSchema.statics.getSecurityEvents = async function (options = {}) {
  const { limit = 100, offset = 0, severity, startDate, endDate } = options;

  const query = {
    event: {
      $in: [
        'XSS_ATTACK_DETECTED',
        'SQL_INJECTION_DETECTED',
        'NOSQL_INJECTION_DETECTED',
        'CSRF_TOKEN_INVALID',
        'UNAUTHORIZED_ACCESS',
        'LOGIN_FAILED',
        'RATE_LIMIT_EXCEEDED',
      ],
    },
  };

  if (severity) {
    query.severity = severity;
  }

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      query.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      query.timestamp.$lte = new Date(endDate);
    }
  }

  const logs = await this.find(query).sort({ timestamp: -1 }).limit(limit).skip(offset);

  const total = await this.countDocuments(query);

  return { logs, total, limit, offset };
};

// Get failed login attempts for IP
auditLogSchema.statics.getFailedLoginsByIP = async function (ip, timeWindow = 15 * 60 * 1000) {
  const since = new Date(Date.now() - timeWindow);

  return await this.countDocuments({
    event: 'LOGIN_FAILED',
    ip,
    timestamp: { $gte: since },
  });
};

// Get events by IP
auditLogSchema.statics.getEventsByIP = async function (ip, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const logs = await this.find({ ip }).sort({ timestamp: -1 }).limit(limit).skip(offset);

  const total = await this.countDocuments({ ip });

  return { logs, total, limit, offset };
};

// Clean up old logs
auditLogSchema.statics.cleanupOldLogs = async function (daysToKeep = 90) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate },
    severity: { $nin: ['high', 'critical'] }, // Keep high/critical logs longer
  });

  return result.deletedCount;
};

// Get audit statistics
auditLogSchema.statics.getStatistics = async function (startDate, endDate) {
  const match = {};

  if (startDate || endDate) {
    match.timestamp = {};
    if (startDate) {
      match.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      match.timestamp.$lte = new Date(endDate);
    }
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return stats;
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
