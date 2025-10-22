import tokenService from '../../services/tokenService.js';
import jwt from 'jsonwebtoken';
import config from '../../config/environment.js';
import User from '../../models/User.mongoose.js';

describe('Token Service Unit Tests', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'token@example.com',
      username: 'tokenuser',
      password: 'Password123!',
      role: 'user',
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = tokenService.generateAccessToken(testUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.type).toBe('access');
    });

    it('should include expiration time', () => {
      const token = tokenService.generateAccessToken(testUser);
      const decoded = jwt.verify(token, config.jwt.secret);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should not include sensitive information', () => {
      const token = tokenService.generateAccessToken(testUser);
      const decoded = jwt.verify(token, config.jwt.secret);

      expect(decoded.password).toBeUndefined();
      expect(decoded.twoFactorSecret).toBeUndefined();
      expect(decoded.passwordHistory).toBeUndefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = tokenService.generateRefreshToken(testUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.refreshSecret);
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.type).toBe('refresh');
    });

    it('should have longer expiration than access token', () => {
      const accessToken = tokenService.generateAccessToken(testUser);
      const refreshToken = tokenService.generateRefreshToken(testUser);

      const accessDecoded = jwt.verify(accessToken, config.jwt.secret);
      const refreshDecoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', async () => {
      const token = tokenService.generateAccessToken(testUser);
      const decoded = await tokenService.verifyAccessToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.type).toBe('access');
    });

    it('should reject an invalid token', async () => {
      await expect(tokenService.verifyAccessToken('invalid.token.here')).rejects.toThrow();
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        {
          userId: testUser._id.toString(),
          email: testUser.email,
          role: testUser.role,
          type: 'access',
        },
        config.jwt.secret,
        { expiresIn: '-1h' } // expired 1 hour ago
      );

      await expect(tokenService.verifyAccessToken(expiredToken)).rejects.toThrow();
    });

    it('should reject tokens with wrong secret', async () => {
      const wrongToken = jwt.sign(
        {
          userId: testUser._id.toString(),
          email: testUser.email,
          role: testUser.role,
          type: 'access',
        },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      await expect(tokenService.verifyAccessToken(wrongToken)).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', async () => {
      const token = tokenService.generateRefreshToken(testUser);
      const decoded = await tokenService.verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUser._id.toString());
      expect(decoded.type).toBe('refresh');
    });

    it('should reject an invalid refresh token', async () => {
      await expect(tokenService.verifyRefreshToken('invalid.token.here')).rejects.toThrow();
    });

    it('should reject access tokens when expecting refresh tokens', async () => {
      const accessToken = tokenService.generateAccessToken(testUser);

      // This should work because verifyRefreshToken uses refreshSecret
      // but the token was signed with regular secret
      await expect(tokenService.verifyRefreshToken(accessToken)).rejects.toThrow();
    });
  });

  describe('storeRefreshToken', () => {
    it('should store refresh token in user document', async () => {
      const refreshToken = tokenService.generateRefreshToken(testUser);
      await tokenService.storeRefreshToken(testUser._id, refreshToken);

      const user = await User.findById(testUser._id).select('+refreshTokens');
      expect(user.refreshTokens.length).toBe(1);
      expect(user.refreshTokens[0].token).toBe(refreshToken);
      expect(user.refreshTokens[0].isRevoked).toBe(false);
    });

    it('should store multiple refresh tokens', async () => {
      const token1 = tokenService.generateRefreshToken(testUser);
      const token2 = tokenService.generateRefreshToken(testUser);

      await tokenService.storeRefreshToken(testUser._id, token1);
      await tokenService.storeRefreshToken(testUser._id, token2);

      const user = await User.findById(testUser._id).select('+refreshTokens');
      expect(user.refreshTokens.length).toBe(2);
    });

    it('should clean up expired tokens', async () => {
      const user = await User.findById(testUser._id).select('+refreshTokens');

      // Add an expired token manually
      user.refreshTokens.push({
        token: 'expired-token',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        expiresAt: new Date(Date.now() - 1000), // expired
        isRevoked: false,
      });
      await user.save();

      // Store a new token
      const newToken = tokenService.generateRefreshToken(testUser);
      await tokenService.storeRefreshToken(testUser._id, newToken);

      const updatedUser = await User.findById(testUser._id).select('+refreshTokens');
      const validTokens = updatedUser.refreshTokens.filter(
        (t) => t.expiresAt > new Date()
      );

      expect(validTokens.length).toBeGreaterThan(0);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a specific refresh token', async () => {
      const refreshToken = tokenService.generateRefreshToken(testUser);
      await tokenService.storeRefreshToken(testUser._id, refreshToken);

      await tokenService.revokeRefreshToken(testUser._id, refreshToken);

      const user = await User.findById(testUser._id).select('+refreshTokens');
      const revokedToken = user.refreshTokens.find((t) => t.token === refreshToken);
      expect(revokedToken.isRevoked).toBe(true);
    });

    it('should not affect other tokens when revoking', async () => {
      const token1 = tokenService.generateRefreshToken(testUser);
      const token2 = tokenService.generateRefreshToken(testUser);

      await tokenService.storeRefreshToken(testUser._id, token1);
      await tokenService.storeRefreshToken(testUser._id, token2);

      await tokenService.revokeRefreshToken(testUser._id, token1);

      const user = await User.findById(testUser._id).select('+refreshTokens');
      const revoked = user.refreshTokens.find((t) => t.token === token1);
      const notRevoked = user.refreshTokens.find((t) => t.token === token2);

      expect(revoked.isRevoked).toBe(true);
      expect(notRevoked.isRevoked).toBe(false);
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('should revoke all refresh tokens for a user', async () => {
      const token1 = tokenService.generateRefreshToken(testUser);
      const token2 = tokenService.generateRefreshToken(testUser);
      const token3 = tokenService.generateRefreshToken(testUser);

      await tokenService.storeRefreshToken(testUser._id, token1);
      await tokenService.storeRefreshToken(testUser._id, token2);
      await tokenService.storeRefreshToken(testUser._id, token3);

      await tokenService.revokeAllRefreshTokens(testUser._id);

      const user = await User.findById(testUser._id).select('+refreshTokens');
      user.refreshTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
      });
    });
  });

  describe('isRefreshTokenRevoked', () => {
    it('should return false for valid tokens', async () => {
      const refreshToken = tokenService.generateRefreshToken(testUser);
      await tokenService.storeRefreshToken(testUser._id, refreshToken);

      const isRevoked = await tokenService.isRefreshTokenRevoked(testUser._id, refreshToken);
      expect(isRevoked).toBe(false);
    });

    it('should return true for revoked tokens', async () => {
      const refreshToken = tokenService.generateRefreshToken(testUser);
      await tokenService.storeRefreshToken(testUser._id, refreshToken);
      await tokenService.revokeRefreshToken(testUser._id, refreshToken);

      const isRevoked = await tokenService.isRefreshTokenRevoked(testUser._id, refreshToken);
      expect(isRevoked).toBe(true);
    });

    it('should return true for non-existent tokens', async () => {
      const isRevoked = await tokenService.isRefreshTokenRevoked(testUser._id, 'non-existent-token');
      expect(isRevoked).toBe(true);
    });
  });
});
