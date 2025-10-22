import TokenService from '../../src/services/tokenService.js';
import jwt from 'jsonwebtoken';
import config from '../../src/config/environment.js';

describe('TokenService', () => {
  const mockUser = {
    userId: '123456789',
    email: 'test@example.com',
    role: 'user',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = TokenService.generateAccessToken(mockUser);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.type).toBe('access');
    });

    it('should include expiration time', () => {
      const token = TokenService.generateAccessToken(mockUser);
      const decoded = jwt.verify(token, config.jwt.secret);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const result = TokenService.generateRefreshToken(mockUser);

      expect(result).toBeTruthy();
      expect(result.token).toBeTruthy();
      expect(typeof result.token).toBe('string');

      const decoded = jwt.verify(result.token, config.jwt.refreshSecret);
      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should have longer expiration than access token', () => {
      const accessToken = TokenService.generateAccessToken(mockUser);
      const { token: refreshToken } = TokenService.generateRefreshToken(mockUser);

      const decodedAccess = jwt.verify(accessToken, config.jwt.secret);
      const decodedRefresh = jwt.verify(refreshToken, config.jwt.refreshSecret);

      expect(decodedRefresh.exp).toBeGreaterThan(decodedAccess.exp);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = TokenService.generateAccessToken(mockUser);
      const decoded = TokenService.verifyAccessToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        TokenService.verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.userId, type: 'access' },
        config.jwt.secret,
        { expiresIn: '-1h', issuer: config.app.name, audience: config.app.name }
      );

      expect(() => {
        TokenService.verifyAccessToken(expiredToken);
      }).toThrow();
    });

    it('should reject refresh token when expecting access token', () => {
      const { token: refreshToken } = TokenService.generateRefreshToken(mockUser);

      expect(() => {
        TokenService.verifyAccessToken(refreshToken);
      }).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const { token } = TokenService.generateRefreshToken(mockUser);
      const decoded = TokenService.verifyRefreshToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(mockUser.userId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        TokenService.verifyRefreshToken('invalid-token');
      }).toThrow();
    });

    it('should reject access token when expecting refresh token', () => {
      const accessToken = TokenService.generateAccessToken(mockUser);

      expect(() => {
        TokenService.verifyRefreshToken(accessToken);
      }).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = TokenService.generateAccessToken(mockUser);
      const decoded = TokenService.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('should decode expired token without throwing', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.userId, email: mockUser.email },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const decoded = TokenService.decodeToken(expiredToken);
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(mockUser.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = TokenService.decodeToken('not-a-valid-jwt');
      expect(decoded).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const { accessToken, refreshToken } = TokenService.generateTokenPair(mockUser);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      const decodedAccess = jwt.verify(accessToken, config.jwt.secret);
      const decodedRefresh = jwt.verify(refreshToken, config.jwt.refreshSecret);

      expect(decodedAccess.userId).toBe(mockUser.userId);
      expect(decodedRefresh.userId).toBe(mockUser.userId);
    });
  });
});
