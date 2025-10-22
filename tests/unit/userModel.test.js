import User from '../../src/models/User.mongoose.js';
import bcrypt from 'bcrypt';

describe('User Model', () => {
  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
      };

      const user = new User(userData);
      await user.save();

      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.role).toBe('user'); // Default role
      expect(user.isActive).toBe(true);
    });

    it('should hash password on save', async () => {
      const plainPassword = 'Test@1234';
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: plainPassword,
      });

      await user.save();

      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[aby]\$/); // Bcrypt hash pattern
    });

    it('should not rehash password if not modified', async () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
      });
      await user.save();

      const originalHash = user.password;
      user.firstName = 'John';
      await user.save();

      expect(user.password).toBe(originalHash);
    });

    it('should add password to history when changed', async () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
      });
      await user.save();

      const userWithHistory = await User.findById(user.id).select('+passwordHistory');
      expect(userWithHistory.passwordHistory).toHaveLength(1);
    });

    it('should enforce email uniqueness', async () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'Test@1234',
      };

      await User.create(userData);

      await expect(
        User.create({
          ...userData,
          username: 'user2', // Different username
        })
      ).rejects.toThrow();
    });

    it('should enforce username uniqueness', async () => {
      const userData = {
        email: 'user1@example.com',
        username: 'duplicate',
        password: 'Test@1234',
      };

      await User.create(userData);

      await expect(
        User.create({
          ...userData,
          email: 'user2@example.com', // Different email
        })
      ).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const user = new User({
        email: 'invalid-email',
        username: 'testuser',
        password: 'Test@1234',
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce minimum username length', async () => {
      const user = new User({
        email: 'test@example.com',
        username: 'ab', // Too short
        password: 'Test@1234',
      });

      await expect(user.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
      });
    });

    describe('comparePassword', () => {
      it('should return true for correct password', async () => {
        const userWithPassword = await User.findById(user.id).select('+password');
        const isMatch = await userWithPassword.comparePassword('Test@1234');
        expect(isMatch).toBe(true);
      });

      it('should return false for incorrect password', async () => {
        const userWithPassword = await User.findById(user.id).select('+password');
        const isMatch = await userWithPassword.comparePassword('WrongPassword');
        expect(isMatch).toBe(false);
      });
    });

    describe('isLocked', () => {
      it('should return false when account is not locked', () => {
        expect(user.isLocked()).toBe(false);
      });

      it('should return true when lockUntil is in the future', () => {
        user.lockUntil = new Date(Date.now() + 60000); // 1 minute from now
        expect(user.isLocked()).toBe(true);
      });

      it('should return false when lockUntil has passed', () => {
        user.lockUntil = new Date(Date.now() - 60000); // 1 minute ago
        expect(user.isLocked()).toBe(false);
      });
    });

    describe('incLoginAttempts', () => {
      it('should increment login attempts', async () => {
        await user.incLoginAttempts();
        expect(user.loginAttempts).toBe(1);
      });

      it('should lock account after 5 failed attempts', async () => {
        for (let i = 0; i < 5; i++) {
          await user.incLoginAttempts();
        }

        expect(user.loginAttempts).toBe(5);
        expect(user.lockUntil).toBeDefined();
        expect(user.isLocked()).toBe(true);
      });

      it('should set lockUntil to 15 minutes from now', async () => {
        for (let i = 0; i < 5; i++) {
          await user.incLoginAttempts();
        }

        const expectedLockUntil = Date.now() + 15 * 60 * 1000;
        const actualLockUntil = user.lockUntil.getTime();

        // Allow 1 second tolerance
        expect(Math.abs(actualLockUntil - expectedLockUntil)).toBeLessThan(1000);
      });
    });

    describe('resetLoginAttempts', () => {
      it('should reset login attempts to 0', async () => {
        user.loginAttempts = 3;
        await user.resetLoginAttempts();

        expect(user.loginAttempts).toBe(0);
      });

      it('should clear lockUntil', async () => {
        user.lockUntil = new Date(Date.now() + 60000);
        await user.resetLoginAttempts();

        expect(user.lockUntil).toBeNull();
      });

      it('should set lastLogin to current time', async () => {
        const beforeReset = Date.now();
        await user.resetLoginAttempts();
        const afterReset = Date.now();

        expect(user.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeReset);
        expect(user.lastLogin.getTime()).toBeLessThanOrEqual(afterReset);
      });
    });

    describe('isPasswordInHistory', () => {
      it('should return true if password was used before', async () => {
        const userWithHistory = await User.findById(user.id).select('+password +passwordHistory');
        const isInHistory = await userWithHistory.isPasswordInHistory('Test@1234');

        expect(isInHistory).toBe(true);
      });

      it('should return false for new password', async () => {
        const userWithHistory = await User.findById(user.id).select('+password +passwordHistory');
        const isInHistory = await userWithHistory.isPasswordInHistory('NewPassword@123');

        expect(isInHistory).toBe(false);
      });

      it('should keep only last 5 passwords in history', async () => {
        const userWithHistory = await User.findById(user.id).select('+password +passwordHistory');

        // Change password 6 times
        for (let i = 1; i <= 6; i++) {
          userWithHistory.password = `NewPassword@${i}`;
          await userWithHistory.save();
        }

        const updatedUser = await User.findById(user.id).select('+passwordHistory');
        expect(updatedUser.passwordHistory).toHaveLength(5);
      });
    });
  });

  describe('Static Methods', () => {
    describe('validatePasswordStrength', () => {
      it('should validate strong password', () => {
        const result = User.validatePasswordStrength('Test@1234');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject password without uppercase', () => {
        const result = User.validatePasswordStrength('test@1234');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
      });

      it('should reject password without lowercase', () => {
        const result = User.validatePasswordStrength('TEST@1234');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });

      it('should reject password without numbers', () => {
        const result = User.validatePasswordStrength('Test@abcd');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number');
      });

      it('should reject password without special characters', () => {
        const result = User.validatePasswordStrength('Test1234');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one special character');
      });

      it('should reject password shorter than 8 characters', () => {
        const result = User.validatePasswordStrength('Test@12');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });
    });

    describe('findByEmail', () => {
      it('should find user by email', async () => {
        await User.create({
          email: 'find@example.com',
          username: 'finduser',
          password: 'Test@1234',
        });

        const found = await User.findByEmail('find@example.com');
        expect(found).toBeTruthy();
        expect(found.email).toBe('find@example.com');
      });

      it('should be case-insensitive', async () => {
        await User.create({
          email: 'case@example.com',
          username: 'caseuser',
          password: 'Test@1234',
        });

        const found = await User.findByEmail('CASE@EXAMPLE.COM');
        expect(found).toBeTruthy();
        expect(found.email).toBe('case@example.com');
      });

      it('should include password field', async () => {
        await User.create({
          email: 'password@example.com',
          username: 'passworduser',
          password: 'Test@1234',
        });

        const found = await User.findByEmail('password@example.com');
        expect(found.password).toBeDefined();
      });
    });

    describe('createUser', () => {
      it('should create user with password validation', async () => {
        const user = await User.createUser({
          email: 'create@example.com',
          username: 'createuser',
          password: 'StrongPass@123',
        });

        expect(user).toBeTruthy();
        expect(user.email).toBe('create@example.com');
      });

      it('should reject weak password', async () => {
        await expect(
          User.createUser({
            email: 'weak@example.com',
            username: 'weakuser',
            password: 'weak',
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('Virtual Fields', () => {
    it('should generate fullName from firstName and lastName', () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(user.fullName).toBe('John Doe');
    });

    it('should handle missing firstName', () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
        lastName: 'Doe',
      });

      expect(user.fullName).toBe('Doe');
    });

    it('should handle missing lastName', () => {
      const user = new User({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@1234',
        firstName: 'John',
      });

      expect(user.fullName).toBe('John');
    });
  });

  describe('JSON Serialization', () => {
    it('should exclude sensitive fields from JSON', async () => {
      const user = await User.create({
        email: 'json@example.com',
        username: 'jsonuser',
        password: 'Test@1234',
      });

      const json = user.toJSON();

      expect(json.password).toBeUndefined();
      expect(json.passwordHistory).toBeUndefined();
      expect(json.twoFactorSecret).toBeUndefined();
      expect(json.emailVerificationToken).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.refreshTokens).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });

    it('should include public fields in JSON', async () => {
      const user = await User.create({
        email: 'public@example.com',
        username: 'publicuser',
        password: 'Test@1234',
      });

      const json = user.toJSON();

      expect(json.email).toBe('public@example.com');
      expect(json.username).toBe('publicuser');
      expect(json.role).toBe('user');
      expect(json.isActive).toBe(true);
    });
  });
});
