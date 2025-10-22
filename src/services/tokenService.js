import jwt from 'jsonwebtoken';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Token Service
 * Handles JWT token generation, validation, and refresh
 */

// In-memory refresh token storage (replace with Redis in production)
const refreshTokens = new Map();

class TokenService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(payload) {
    try {
      const token = jwt.sign(
        {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          type: 'access',
        },
        config.jwt.secret,
        {
          expiresIn: config.jwt.expiresIn,
          issuer: config.app.name,
          audience: config.app.name,
        }
      );

      return token;
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token (long-lived)
   */
  static generateRefreshToken(payload) {
    try {
      const tokenId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const token = jwt.sign(
        {
          userId: payload.userId,
          email: payload.email,
          tokenId,
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        {
          expiresIn: config.jwt.refreshExpiresIn,
          issuer: config.app.name,
          audience: config.app.name,
        }
      );

      // Store refresh token with metadata
      refreshTokens.set(tokenId, {
        userId: payload.userId,
        token,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseExpiry(config.jwt.refreshExpiresIn)),
        isRevoked: false,
      });

      return { token, tokenId };
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const { token: refreshToken, tokenId } = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      tokenId,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.app.name,
        audience: config.app.name,
      });

      // Check token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: config.app.name,
        audience: config.app.name,
      });

      // Check token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is revoked
      const storedToken = refreshTokens.get(decoded.tokenId);
      if (!storedToken || storedToken.isRevoked) {
        throw new Error('Refresh token revoked');
      }

      // Check if token matches stored token
      if (storedToken.token !== token) {
        throw new Error('Invalid refresh token');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Revoke refresh token
   */
  static revokeRefreshToken(tokenId) {
    const storedToken = refreshTokens.get(tokenId);
    if (storedToken) {
      storedToken.isRevoked = true;
      refreshTokens.set(tokenId, storedToken);
      logger.info(`Refresh token revoked: ${tokenId}`);
      return true;
    }
    return false;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static revokeAllUserTokens(userId) {
    let count = 0;
    for (const [tokenId, tokenData] of refreshTokens) {
      if (tokenData.userId === userId && !tokenData.isRevoked) {
        tokenData.isRevoked = true;
        refreshTokens.set(tokenId, tokenData);
        count++;
      }
    }
    logger.info(`Revoked ${count} refresh tokens for user: ${userId}`);
    return count;
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);

      // Generate new access token
      const accessToken = await this.generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      return {
        accessToken,
        expiresIn: config.jwt.expiresIn,
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error.message);
      throw error;
    }
  }

  /**
   * Rotate refresh token (generate new refresh token and revoke old one)
   */
  static async rotateRefreshToken(oldRefreshToken) {
    try {
      // Verify old refresh token
      const decoded = this.verifyRefreshToken(oldRefreshToken);

      // Revoke old token
      this.revokeRefreshToken(decoded.tokenId);

      // Generate new token pair
      const tokenPair = this.generateTokenPair({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      logger.info(`Refresh token rotated for user: ${decoded.userId}`);

      return tokenPair;
    } catch (error) {
      logger.error('Error rotating refresh token:', error.message);
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Clean up expired tokens
   */
  static cleanupExpiredTokens() {
    const now = Date.now();
    let count = 0;

    for (const [tokenId, tokenData] of refreshTokens) {
      if (tokenData.expiresAt < now) {
        refreshTokens.delete(tokenId);
        count++;
      }
    }

    if (count > 0) {
      logger.info(`Cleaned up ${count} expired refresh tokens`);
    }

    return count;
  }

  /**
   * Get user's active refresh tokens
   */
  static getUserRefreshTokens(userId) {
    const userTokens = [];

    for (const [tokenId, tokenData] of refreshTokens) {
      if (tokenData.userId === userId && !tokenData.isRevoked) {
        userTokens.push({
          tokenId,
          createdAt: tokenData.createdAt,
          expiresAt: tokenData.expiresAt,
        });
      }
    }

    return userTokens;
  }

  /**
   * Parse expiry string to milliseconds
   */
  static parseExpiry(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60 * 1000; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || 1000);
  }

  /**
   * Get token statistics
   */
  static getTokenStats() {
    const now = Date.now();
    let active = 0;
    let revoked = 0;
    let expired = 0;

    for (const [, tokenData] of refreshTokens) {
      if (tokenData.isRevoked) {
        revoked++;
      } else if (tokenData.expiresAt < now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: refreshTokens.size,
      active,
      revoked,
      expired,
    };
  }
}

// Run cleanup every hour
setInterval(
  () => {
    TokenService.cleanupExpiredTokens();
  },
  60 * 60 * 1000
);

export default TokenService;
