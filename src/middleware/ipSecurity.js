import { logSecurityEvent } from '../utils/logger.js';
import AuditLog from '../models/AuditLog.js';

/**
 * IP-Based Security Middleware
 * Tracks and blocks suspicious IP addresses
 */

// In-memory store for failed attempts (use Redis in production)
const ipFailedAttempts = new Map();
const blockedIPs = new Set();

/**
 * Track failed login attempts by IP
 */
export const trackFailedAttempt = (ip) => {
  const attempts = ipFailedAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };

  attempts.count++;
  attempts.lastAttempt = Date.now();

  if (!attempts.firstAttempt) {
    attempts.firstAttempt = Date.now();
  }

  ipFailedAttempts.set(ip, attempts);

  // Block IP after 10 failed attempts in 15 minutes
  if (attempts.count >= 10) {
    blockedIPs.add(ip);

    logSecurityEvent('IP_BLOCKED', {
      ip,
      reason: 'Too many failed attempts',
      attempts: attempts.count,
    });

    // Auto-unblock after 1 hour
    setTimeout(() => {
      blockedIPs.delete(ip);
      ipFailedAttempts.delete(ip);

      logSecurityEvent('IP_UNBLOCKED', {
        ip,
        reason: 'Auto-unblock after timeout',
      });
    }, 60 * 60 * 1000); // 1 hour
  }
};

/**
 * Clear failed attempts for IP
 */
export const clearFailedAttempts = (ip) => {
  ipFailedAttempts.delete(ip);
};

/**
 * Check if IP is blocked
 */
export const checkIPBlock = () => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;

    if (blockedIPs.has(ip)) {
      logSecurityEvent('BLOCKED_IP_ACCESS_ATTEMPT', {
        ip,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'Your IP address has been temporarily blocked due to suspicious activity',
      });
    }

    next();
  };
};

/**
 * IP Whitelist middleware
 */
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;

    if (!allowedIPs.includes(ip) && !allowedIPs.includes('*')) {
      logSecurityEvent('IP_WHITELIST_VIOLATION', {
        ip,
        path: req.path,
        allowedIPs,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied from your IP address',
      });
    }

    next();
  };
};

/**
 * IP Blacklist middleware
 */
export const ipBlacklist = (blockedIPList = []) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;

    if (blockedIPList.includes(ip)) {
      logSecurityEvent('IP_BLACKLIST_MATCH', {
        ip,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    next();
  };
};

/**
 * Detect suspicious IP patterns
 */
export const detectSuspiciousIP = () => {
  return async (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;

    // Check for rapid requests from same IP (simple bot detection)
    const recentLogs = await AuditLog.find({
      ip,
      timestamp: { $gte: new Date(Date.now() - 60 * 1000) }, // Last minute
    }).limit(100);

    if (recentLogs.length > 100) {
      logSecurityEvent('SUSPICIOUS_IP_ACTIVITY', {
        ip,
        requestCount: recentLogs.length,
        timeWindow: '1 minute',
      });

      // Optional: Auto-block
      // blockedIPs.add(ip);
    }

    next();
  };
};

/**
 * Get IP statistics
 */
export const getIPStats = async (ip) => {
  const attempts = ipFailedAttempts.get(ip);
  const isBlocked = blockedIPs.has(ip);

  const recentActivity = await AuditLog.find({
    ip,
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
  }).limit(1000);

  return {
    ip,
    isBlocked,
    failedAttempts: attempts?.count || 0,
    recentActivityCount: recentActivity.length,
    lastActivity: recentActivity[0]?.timestamp,
  };
};

/**
 * Manual block/unblock IP
 */
export const blockIP = (ip, reason = 'Manual block') => {
  blockedIPs.add(ip);

  logSecurityEvent('IP_BLOCKED', {
    ip,
    reason,
    manual: true,
  });

  return { success: true, message: `IP ${ip} has been blocked` };
};

export const unblockIP = (ip) => {
  blockedIPs.delete(ip);
  ipFailedAttempts.delete(ip);

  logSecurityEvent('IP_UNBLOCKED', {
    ip,
    manual: true,
  });

  return { success: true, message: `IP ${ip} has been unblocked` };
};

export default {
  trackFailedAttempt,
  clearFailedAttempts,
  checkIPBlock,
  ipWhitelist,
  ipBlacklist,
  detectSuspiciousIP,
  getIPStats,
  blockIP,
  unblockIP,
};
