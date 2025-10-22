import TwoFactorService from '../../src/services/twoFactorService.js';
import speakeasy from 'speakeasy';

describe('TwoFactorService', () => {
  const mockEmail = 'test@example.com';
  const mockUsername = 'testuser';

  describe('generateSecret', () => {
    it('should generate a secret with base32 encoding', () => {
      const { secret, otpauthUrl } = TwoFactorService.generateSecret(mockEmail, mockUsername);

      expect(secret).toBeTruthy();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);

      // Base32 should only contain A-Z and 2-7
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it('should generate otpauth URL', () => {
      const { otpauthUrl } = TwoFactorService.generateSecret(mockEmail, mockUsername);

      expect(otpauthUrl).toBeTruthy();
      expect(otpauthUrl).toContain('otpauth://totp/');
      expect(otpauthUrl).toContain(mockUsername);
    });

    it('should generate different secrets on each call', () => {
      const result1 = TwoFactorService.generateSecret(mockEmail, mockUsername);
      const result2 = TwoFactorService.generateSecret(mockEmail, mockUsername);

      expect(result1.secret).not.toBe(result2.secret);
    });
  });

  describe('generateQRCode', () => {
    it('should generate a QR code data URL', async () => {
      const { otpauthUrl } = TwoFactorService.generateSecret(mockEmail, mockUsername);
      const qrCode = await TwoFactorService.generateQRCode(otpauthUrl);

      expect(qrCode).toBeTruthy();
      expect(qrCode).toContain('data:image/png;base64,');
    });

    it('should generate different QR codes for different URLs', async () => {
      const { otpauthUrl: url1 } = TwoFactorService.generateSecret('user1@example.com', 'user1');
      const { otpauthUrl: url2 } = TwoFactorService.generateSecret('user2@example.com', 'user2');

      const qr1 = await TwoFactorService.generateQRCode(url1);
      const qr2 = await TwoFactorService.generateQRCode(url2);

      expect(qr1).not.toBe(qr2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const { secret } = TwoFactorService.generateSecret(mockEmail, mockUsername);

      // Generate a valid token using the same secret
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      const isValid = TwoFactorService.verifyToken(secret, token);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid token', () => {
      const { secret } = TwoFactorService.generateSecret(mockEmail, mockUsername);
      const invalidToken = '000000';

      const isValid = TwoFactorService.verifyToken(secret, invalidToken);
      expect(isValid).toBe(false);
    });

    it('should reject token with wrong secret', () => {
      const { secret: secret1 } = TwoFactorService.generateSecret('user1@example.com', 'user1');
      const { secret: secret2 } = TwoFactorService.generateSecret('user2@example.com', 'user2');

      const token = speakeasy.totp({
        secret: secret1,
        encoding: 'base32',
      });

      const isValid = TwoFactorService.verifyToken(secret2, token);
      expect(isValid).toBe(false);
    });

    it('should accept tokens within time window', () => {
      const { secret } = TwoFactorService.generateSecret(mockEmail, mockUsername);

      // Generate token for current time
      const currentToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000),
      });

      // Generate token for 30 seconds ago (within window of 2)
      const pastToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 30,
      });

      expect(TwoFactorService.verifyToken(secret, currentToken)).toBe(true);
      expect(TwoFactorService.verifyToken(secret, pastToken)).toBe(true);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const codes = TwoFactorService.generateBackupCodes();

      expect(codes).toBeInstanceOf(Array);
      expect(codes.length).toBe(10);
    });

    it('should generate custom number of codes', () => {
      const codes = TwoFactorService.generateBackupCodes(5);
      expect(codes.length).toBe(5);
    });

    it('should generate unique codes', () => {
      const codes = TwoFactorService.generateBackupCodes(20);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should generate uppercase alphanumeric codes', () => {
      const codes = TwoFactorService.generateBackupCodes();

      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]+$/);
        expect(code.length).toBeGreaterThan(0);
      });
    });

    it('should generate different codes on each call', () => {
      const codes1 = TwoFactorService.generateBackupCodes(5);
      const codes2 = TwoFactorService.generateBackupCodes(5);

      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('verifyBackupCode', () => {
    it('should find matching backup code and return index', () => {
      const backupCodes = ['CODE1ABC', 'CODE2DEF', 'CODE3GHI'];
      const index = TwoFactorService.verifyBackupCode(backupCodes, 'CODE2DEF');

      expect(index).toBe(1);
    });

    it('should return false for non-existent code', () => {
      const backupCodes = ['CODE1ABC', 'CODE2DEF', 'CODE3GHI'];
      const index = TwoFactorService.verifyBackupCode(backupCodes, 'INVALID');

      expect(index).toBe(false);
    });

    it('should return false for empty backup codes array', () => {
      const index = TwoFactorService.verifyBackupCode([], 'CODE1ABC');
      expect(index).toBe(false);
    });

    it('should be case-insensitive', () => {
      const backupCodes = ['CODE1ABC'];
      const indexUpper = TwoFactorService.verifyBackupCode(backupCodes, 'CODE1ABC');
      const indexLower = TwoFactorService.verifyBackupCode(backupCodes, 'code1abc');

      expect(indexUpper).toBe(0);
      expect(indexLower).toBe(0); // Should find it after converting to uppercase
    });
  });
});
