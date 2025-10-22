import { logSecurityEvent } from '../utils/logger.js';
import {
  hasPermission as checkPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasHigherOrEqualRole,
  isResourceOwner as checkResourceOwner,
  PERMISSIONS,
} from '../config/permissions.js';

/**
 * Authorization Middleware
 * Role-Based Access Control (RBAC) and Permission-Based Access Control
 */

/**
 * Check if user has required role(s)
 * Use after authenticate middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logSecurityEvent('AUTHORIZATION_FAILED', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

/**
 * Check if user has admin role
 * Shorthand for authorize('admin')
 */
export const isAdmin = authorize('admin');

/**
 * Check if user has moderator or admin role
 */
export const isModerator = authorize('admin', 'moderator');

/**
 * Check if user has any authenticated role (user, moderator, admin)
 */
export const isAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
  next();
};

/**
 * Permission-based authorization
 * More granular than role-based
 * @param {string|string[]} requiredPermissions - Required permission(s)
 * @param {string} mode - 'all' (default) or 'any'
 */
export const requirePermission = (requiredPermissions, mode = 'all') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    let hasAccess = false;

    if (mode === 'any') {
      hasAccess = hasAnyPermission(userRole, permissions);
    } else {
      hasAccess = hasAllPermissions(userRole, permissions);
    }

    if (!hasAccess) {
      logSecurityEvent('PERMISSION_DENIED', {
        userId: req.user.id,
        userRole,
        requiredPermissions: permissions,
        mode,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have the required permissions.',
      });
    }

    next();
  };
};

// Keep old name for backward compatibility
export const hasPermission = requirePermission;

/**
 * Check if user is verified
 */
export const isVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
    });
  }

  next();
};

/**
 * Custom access control based on callback
 */
export const customAuthorization = (checkCallback) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    try {
      const isAuthorized = await checkCallback(req);

      if (!isAuthorized) {
        logSecurityEvent('CUSTOM_AUTHORIZATION_FAILED', {
          userId: req.user.id,
          ip: req.ip,
          path: req.path,
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
      });
    }
  };
};

/**
 * Check if user can modify resource (owner or admin)
 */
export const canModify = (resourceOwnerIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get resource owner ID from request params, body, or query
    const resourceOwnerId =
      req.params[resourceOwnerIdField] ||
      req.body[resourceOwnerIdField] ||
      req.query[resourceOwnerIdField];

    // Admin can modify anything
    if (req.user.role === 'admin') {
      return next();
    }

    // Owner can modify their own resources
    if (req.user.id === resourceOwnerId) {
      return next();
    }

    logSecurityEvent('MODIFICATION_DENIED', {
      userId: req.user.id,
      resourceOwnerId,
      ip: req.ip,
      path: req.path,
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only modify your own resources.',
    });
  };
};

/**
 * Rate limit for specific roles
 */
export const roleRateLimit = (limits) => {
  const roleLimits = {
    admin: limits.admin || 1000,
    moderator: limits.moderator || 500,
    user: limits.user || 100,
    guest: limits.guest || 50,
  };

  const userRequests = new Map();
  const windowMs = 15 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const maxRequests = roleLimits[userRole] || roleLimits.user;

    const now = Date.now();
    const userKey = userId;

    if (!userRequests.has(userKey)) {
      userRequests.set(userKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const userData = userRequests.get(userKey);

    if (now > userData.resetTime) {
      userRequests.set(userKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userData.count >= maxRequests) {
      logSecurityEvent('ROLE_RATE_LIMIT_EXCEEDED', {
        userId,
        userRole,
        maxRequests,
        ip: req.ip,
      });

      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded for your role',
      });
    }

    userData.count++;
    userRequests.set(userKey, userData);
    next();
  };
};

/**
 * Require ownership or specific permission
 * User must own the resource or have override permission
 */
export const requireOwnershipOrPermission = (resourceIdParam = 'userId', overridePermission = null) => {
  return (req, res, next) => {
    if (!req.user || !req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const resourceOwnerId = req.params[resourceIdParam] || req.body[resourceIdParam];
    const userRole = req.user.role;

    // Check if user owns the resource
    const isOwner = checkResourceOwner(req.userId, resourceOwnerId);

    // Check if user has override permission
    let hasOverride = false;
    if (overridePermission) {
      hasOverride = checkPermission(userRole, overridePermission);
    }

    // Admin always has access
    const isAdminUser = userRole === 'admin';

    if (!isOwner && !hasOverride && !isAdminUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', {
        reason: 'Not resource owner and no override permission',
        userId: req.userId,
        userRole,
        resourceOwnerId,
        overridePermission,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.',
      });
    }

    next();
  };
};

/**
 * Check role hierarchy
 * Ensures user has higher or equal role than target
 */
export const requireHigherOrEqualRole = (targetRoleParam = 'role') => {
  return (req, res, next) => {
    if (!req.user || !req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const targetRole = req.body[targetRoleParam] || req.params[targetRoleParam];

    if (!targetRole) {
      return next();
    }

    if (!hasHigherOrEqualRole(userRole, targetRole)) {
      logSecurityEvent('AUTHORIZATION_FAILED', {
        reason: 'Insufficient role hierarchy',
        userId: req.userId,
        userRole,
        targetRole,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You cannot perform this action on a user with higher privileges.',
      });
    }

    next();
  };
};

/**
 * Prevent self-action
 * Prevents user from performing an action on themselves
 */
export const preventSelfAction = (targetUserIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const targetUserId = req.params[targetUserIdParam] || req.body[targetUserIdParam];

    if (req.userId === targetUserId || req.userId === targetUserId?.toString()) {
      logSecurityEvent('AUTHORIZATION_FAILED', {
        reason: 'Self-action prevented',
        userId: req.userId,
        action: req.path,
        ip: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: 'You cannot perform this action on yourself.',
      });
    }

    next();
  };
};

export default {
  authorize,
  isAdmin,
  isModerator,
  isAuthenticated,
  hasPermission,
  requirePermission,
  isVerified,
  customAuthorization,
  canModify,
  roleRateLimit,
  requireOwnershipOrPermission,
  requireHigherOrEqualRole,
  preventSelfAction,
  PERMISSIONS,
};
