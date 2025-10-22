import TokenService from '../services/tokenService.js';
import User from '../models/User.mongoose.js';
import logger, { logSecurityEvent } from '../utils/logger.js';

/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

/**
 * Authenticate user via JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log({ token });
    // Verify token
    let decoded;
    try {
      decoded = TokenService.verifyAccessToken(token);
    } catch (error) {
      logSecurityEvent('AUTHENTICATION_FAILED', {
        reason: error.message,
        ip: req.ip,
        path: req.path,
      });

      return res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token',
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      logSecurityEvent('AUTHENTICATION_FAILED', {
        reason: 'User not found',
        userId: decoded.userId,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logSecurityEvent('AUTHENTICATION_FAILED', {
        reason: 'User inactive',
        userId: user.id,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // Attach user to request
    req.user = user.toJSON();
    req.userId = user.id;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for public endpoints that can benefit from user context
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = TokenService.verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user.toJSON();
        req.userId = user.id;
      }
    } catch (error) {
      // Token invalid, continue without user
      logger.warn('Optional auth - invalid token:', error.message);
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next();
  }
};

/**
 * Verify refresh token from cookie or body
 */
export const verifyRefreshToken = async (req, res, next) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    // Verify token
    try {
      const decoded = TokenService.verifyRefreshToken(refreshToken);
      req.refreshToken = refreshToken;
      req.tokenId = decoded.tokenId;
      req.userId = decoded.userId;
      next();
    } catch (error) {
      logSecurityEvent('REFRESH_TOKEN_FAILED', {
        reason: error.message,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired refresh token',
      });
    }
  } catch (error) {
    logger.error('Refresh token middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token verification error',
    });
  }
};

/**
 * Check if user owns the resource
 * Use after authenticate middleware
 */
export const isResourceOwner = (resourceUserIdParam = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceUserIdParam];

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (req.userId !== resourceUserId) {
      // Allow if user is admin
      if (req.user?.role === 'admin') {
        return next();
      }

      logSecurityEvent('UNAUTHORIZED_ACCESS', {
        userId: req.userId,
        attemptedResource: resourceUserId,
        ip: req.ip,
        path: req.path,
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
 * Rate limit based on user ID (after authentication)
 */
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.userId;

    if (!userId) {
      return next();
    }

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
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        userId,
        ip: req.ip,
        path: req.path,
      });

      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    userData.count++;
    userRequests.set(userKey, userData);
    next();
  };
};

export default {
  authenticate,
  optionalAuthenticate,
  verifyRefreshToken,
  isResourceOwner,
  userRateLimit,
};
