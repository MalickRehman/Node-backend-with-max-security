import User from '../../models/User.mongoose.js';
import bcrypt from 'bcrypt';

describe('User Model Unit Tests', () => {
  describe('User Creation', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email.toLowerCase());
      expect(user.username).toBe(userData.username);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe('user'); // default role
      expect(user.isActive).toBe(true); // default
      expect(user.isEmailVerified).toBe(false); // default
    });

    it('should hash password before saving', async () => {
      const password = 'TestPassword123!';
      const user = await User.create({
        email: 'hash@example.com',
        username: 'hashuser',
        password,
      });

      expect(user.password).not.toBe(password);
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format
    });

    it('should not require password for OAuth users', async () => {
      const user = await User.create({
        email: 'oauth@example.com',
        username: 'oauthuser',
        authProvider: 'google',
        oauth: {
          google: {
            id: 'google123',
            email: 'oauth@example.com',
            displayName: 'OAuth User',
          },
        },
      });

      expect(user).toBeDefined();
      expect(user.authProvider).toBe('google');
      expect(user.oauth.google.id).toBe('google123');
    });

    it('should fail with duplicate email', async () => {
      await User.create({
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'Password123!',
      });

      await expect(
        User.create({
          email: 'duplicate@example.com',
          username: 'user2',
          password: 'Password123!',
        })
      ).rejects.toThrow();
    });

    it('should fail with duplicate username', async () => {
      await User.create({
        email: 'user1@example.com',
        username: 'sameusername',
        password: 'Password123!',
      });

      await expect(
        User.create({
          email: 'user2@example.com',
          username: 'sameusername',
          password: 'Password123!',
        })
      ).rejects.toThrow();
    });

    it('should fail without required fields', async () => {
      await expect(User.create({})).rejects.toThrow();
      await expect(User.create({ email: 'test@example.com' })).rejects.toThrow();
      await expect(User.create({ username: 'testuser' })).rejects.toThrow();
    });
  });

  describe('Password Methods', () => {
    it('should correctly compare passwords', async () => {
      const password = 'TestPassword123!';
      const user = await User.create({
        email: 'compare@example.com',
        username: 'compareuser',
        password,
      });

      // Reload user with password field
      const userWithPassword = await User.findById(user._id).select('+password');

      const isMatch = await userWithPassword.comparePassword(password);
      expect(isMatch).toBe(true);

      const isNotMatch = await userWithPassword.comparePassword('WrongPassword123!');
      expect(isNotMatch).toBe(false);
    });

    it('should maintain password history', async () => {
      const user = await User.create({
        email: 'history@example.com',
        username: 'historyuser',
        password: 'Password123!',
      });

      const userWithHistory = await User.findById(user._id).select('+passwordHistory');
      expect(userWithHistory.passwordHistory.length).toBe(1);

      // Change password
      userWithHistory.password = 'NewPassword456!';
      await userWithHistory.save();

      const updatedUser = await User.findById(user._id).select('+passwordHistory');
      expect(updatedUser.passwordHistory.length).toBe(2);
    });

    it('should limit password history to 5 entries', async () => {
      const user = await User.create({
        email: 'limit@example.com',
        username: 'limituser',
        password: 'Password1!',
      });

      // Change password 6 times
      for (let i = 2; i <= 7; i++) {
        const userToUpdate = await User.findById(user._id).select('+password +passwordHistory');
        userToUpdate.password = `Password${i}!`;
        await userToUpdate.save();
      }

      const finalUser = await User.findById(user._id).select('+passwordHistory');
      expect(finalUser.passwordHistory.length).toBe(5);
    });

    it('should detect password reuse', async () => {
      const password = 'TestPassword123!';
      const user = await User.create({
        email: 'reuse@example.com',
        username: 'reuseuser',
        password,
      });

      const userWithHistory = await User.findById(user._id).select('+passwordHistory');
      const isInHistory = await userWithHistory.isPasswordInHistory(password);
      expect(isInHistory).toBe(true);

      const isNotInHistory = await userWithHistory.isPasswordInHistory('DifferentPassword123!');
      expect(isNotInHistory).toBe(false);
    });

    it('should validate password strength', () => {
      const validPassword = 'StrongPassword123!';
      const validation = User.validatePasswordStrength(validPassword);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'short', // too short
        'nouppercase123!', // no uppercase
        'NOLOWERCASE123!', // no lowercase
        'NoNumbers!', // no numbers
        'NoSpecialChar123', // no special characters
      ];

      weakPasswords.forEach((password) => {
        const validation = User.validatePasswordStrength(password);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Account Locking', () => {
    it('should lock account after 5 failed attempts', async () => {
      const user = await User.create({
        email: 'lock@example.com',
        username: 'lockuser',
        password: 'Password123!',
      });

      // Simulate 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await user.incLoginAttempts();
      }

      const lockedUser = await User.findById(user._id);
      expect(lockedUser.isLocked()).toBe(true);
      expect(lockedUser.loginAttempts).toBe(5);
    });

    it('should reset login attempts after successful login', async () => {
      const user = await User.create({
        email: 'reset@example.com',
        username: 'resetuser',
        password: 'Password123!',
      });

      // Fail some attempts
      await user.incLoginAttempts();
      await user.incLoginAttempts();
      expect(user.loginAttempts).toBe(2);

      // Successful login
      await user.resetLoginAttempts();

      const resetUser = await User.findById(user._id);
      expect(resetUser.loginAttempts).toBe(0);
      expect(resetUser.lockUntil).toBeNull();
      expect(resetUser.lastLogin).toBeDefined();
    });
  });

  describe('Virtual Fields', () => {
    it('should return full name from virtual field', async () => {
      const user = await User.create({
        email: 'name@example.com',
        username: 'nameuser',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(user.fullName).toBe('John Doe');
    });

    it('should handle missing name fields', async () => {
      const user = await User.create({
        email: 'noname@example.com',
        username: 'nonameuser',
        password: 'Password123!',
      });

      expect(user.fullName).toBe('');
    });
  });

  describe('Static Methods', () => {
    it('should find user by email', async () => {
      const email = 'findemail@example.com';
      await User.create({
        email,
        username: 'findemailuser',
        password: 'Password123!',
      });

      const user = await User.findByEmail(email);
      expect(user).toBeDefined();
      expect(user.email).toBe(email);
    });

    it('should find user by username', async () => {
      const username = 'findusername';
      await User.create({
        email: 'findusername@example.com',
        username,
        password: 'Password123!',
      });

      const user = await User.findByUsername(username);
      expect(user).toBeDefined();
      expect(user.username).toBe(username);
    });
  });

  describe('JSON Transformation', () => {
    it('should not expose sensitive fields in JSON', async () => {
      const user = await User.create({
        email: 'json@example.com',
        username: 'jsonuser',
        password: 'Password123!',
      });

      const userJSON = user.toJSON();

      expect(userJSON.password).toBeUndefined();
      expect(userJSON.passwordHistory).toBeUndefined();
      expect(userJSON.twoFactorSecret).toBeUndefined();
      expect(userJSON.refreshTokens).toBeUndefined();
      expect(userJSON.__v).toBeUndefined();
    });
  });
});
