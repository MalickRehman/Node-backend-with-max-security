import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.mongoose.js';

describe('Authentication Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'StrongPassword123!',
        firstName: 'New',
        lastName: 'User',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'Password123!',
      };

      // Register first user
      await request(app).post('/api/v1/auth/register').send(userData);

      // Try to register with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...userData, username: 'user2' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject weak passwords', async () => {
      const userData = {
        email: 'weak@example.com',
        username: 'weakuser',
        password: 'weak', // too weak
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'invaliduser',
        password: 'Password123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        email: 'login@example.com',
        username: 'loginuser',
        password: 'Password123!',
      });
    });

    it('should login with valid email and password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'login@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('login@example.com');
    });

    it('should login with valid username and password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'loginuser',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('loginuser');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'login@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should lock account after 5 failed attempts', async () => {
      // Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: 'login@example.com',
            password: 'WrongPassword!',
          });
      }

      // 6th attempt should show account locked
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'login@example.com',
          password: 'Password123!', // even with correct password
        })
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('locked');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      // Register and get tokens
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@example.com',
          username: 'refreshuser',
          password: 'Password123!',
        });

      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.accessToken).not.toBe(refreshToken);
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let refreshToken;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'logout@example.com',
          username: 'logoutuser',
          password: 'Password123!',
        });

      refreshToken = response.body.data.refreshToken;
    });

    it('should logout successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');
    });

    it('should not allow using revoked refresh token', async () => {
      // Logout (revoke token)
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      // Try to use the same token again
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'me@example.com',
          username: 'meuser',
          password: 'Password123!',
          firstName: 'Me',
          lastName: 'User',
        });

      accessToken = response.body.data.accessToken;
    });

    it('should get current user with valid access token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.body.data.username).toBe('meuser');
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let accessToken;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'changepass@example.com',
          username: 'changepassuser',
          password: 'OldPassword123!',
        });

      accessToken = response.body.data.accessToken;
    });

    it('should change password with valid current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Try logging in with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'changepass@example.com',
          password: 'NewPassword456!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject password change with wrong current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject weak new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoint', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: 'test@example.com',
            password: 'Password123!',
          });
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'test@example.com',
          password: 'Password123!',
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Too many');
    });
  });
});
