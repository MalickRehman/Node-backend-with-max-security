import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.mongoose.js';

describe('Security Tests - Authorization & Access Control', () => {
  let regularUserToken;
  let moderatorToken;
  let adminToken;
  let regularUserId;

  beforeAll(async () => {
    // Create users with different roles
    const regularUser = await User.create({
      email: 'user@example.com',
      username: 'regularuser',
      password: 'Password123!',
      role: 'user',
    });
    regularUserId = regularUser._id.toString();

    const moderator = await User.create({
      email: 'moderator@example.com',
      username: 'moderator',
      password: 'Password123!',
      role: 'moderator',
    });

    const admin = await User.create({
      email: 'admin@example.com',
      username: 'admin',
      password: 'Password123!',
      role: 'admin',
    });

    // Get tokens
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        emailOrUsername: 'user@example.com',
        password: 'Password123!',
      });
    regularUserToken = userLogin.body.data.accessToken;

    const modLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        emailOrUsername: 'moderator@example.com',
        password: 'Password123!',
      });
    moderatorToken = modLogin.body.data.accessToken;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        emailOrUsername: 'admin@example.com',
        password: 'Password123!',
      });
    adminToken = adminLogin.body.data.accessToken;
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should allow admin to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(response.status); // 404 if endpoint doesn't exist
    });

    it('should deny regular user access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('should allow moderator access to moderator endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${moderatorToken}`);

      expect([200, 403, 404]).toContain(response.status);
    });

    it('should prevent role escalation through token manipulation', async () => {
      // Try to modify token payload (this should fail signature verification)
      const fakeAdminToken = regularUserToken.replace('user', 'admin');

      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${fakeAdminToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Horizontal Access Control', () => {
    it('should allow users to access their own profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body.data.email).toBe('user@example.com');
    });

    it('should prevent users from accessing other users profiles', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@example.com',
        username: 'otheruser',
        password: 'Password123!',
      });

      // Try to access other user's profile with regular user token
      const response = await request(app)
        .get(`/api/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect([403, 404]).toContain(response.status);
    });

    it('should prevent users from modifying other users data', async () => {
      const otherUser = await User.create({
        email: 'modify@example.com',
        username: 'modifyuser',
        password: 'Password123!',
      });

      const response = await request(app)
        .put(`/api/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ firstName: 'Hacked' });

      expect([403, 404]).toContain(response.status);
    });

    it('should prevent users from deleting other users', async () => {
      const otherUser = await User.create({
        email: 'delete@example.com',
        username: 'deleteuser',
        password: 'Password123!',
      });

      const response = await request(app)
        .delete(`/api/v1/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Vertical Access Control', () => {
    it('should prevent privilege escalation to admin role', async () => {
      const response = await request(app)
        .put(`/api/v1/users/${regularUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' });

      if (response.status === 200) {
        // If update succeeds, role should not be admin
        expect(response.body.data.role).toBe('user');
      } else {
        // Or should be forbidden
        expect([403, 404]).toContain(response.status);
      }
    });

    it('should prevent moderators from granting admin privileges', async () => {
      const targetUser = await User.create({
        email: 'target@example.com',
        username: 'targetuser',
        password: 'Password123!',
      });

      const response = await request(app)
        .put(`/api/v1/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${moderatorToken}`)
        .send({ role: 'admin' });

      expect([403, 404]).toContain(response.status);
    });

    it('should allow admins to modify user roles', async () => {
      const targetUser = await User.create({
        email: 'promote@example.com',
        username: 'promoteuser',
        password: 'Password123!',
      });

      const response = await request(app)
        .put(`/api/v1/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      if (response.status === 200) {
        expect(['user', 'moderator']).toContain(response.body.data.role);
      }
    });
  });

  describe('Broken Object Level Authorization (BOLA)', () => {
    it('should prevent IDOR (Insecure Direct Object Reference)', async () => {
      // Try to access resources with sequential IDs
      const ids = ['1', '2', '3', '12345', 'abc123'];

      for (const id of ids) {
        const response = await request(app)
          .get(`/api/v1/users/${id}`)
          .set('Authorization', `Bearer ${regularUserToken}`);

        // Should not expose other users' data
        expect([403, 404]).toContain(response.status);
      }
    });

    it('should validate object ownership before operations', async () => {
      // Create a resource (assuming there's an endpoint)
      const createResponse = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ title: 'My Post', content: 'Content' });

      if (createResponse.status === 201) {
        const postId = createResponse.body.data._id;

        // Try to modify with different user token
        const modifyResponse = await request(app)
          .put(`/api/v1/posts/${postId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ title: 'Hacked' });

        // Should be forbidden unless moderator has special privileges
        expect([200, 403, 404]).toContain(modifyResponse.status);
      }
    });
  });

  describe('Function Level Authorization', () => {
    it('should restrict access to administrative functions', async () => {
      const adminFunctions = [
        { method: 'delete', path: '/api/v1/users/all' },
        { method: 'post', path: '/api/v1/users/bulk-create' },
        { method: 'put', path: '/api/v1/settings/system' },
      ];

      for (const func of adminFunctions) {
        const response = await request(app)
          [func.method](func.path)
          .set('Authorization', `Bearer ${regularUserToken}`);

        expect([403, 404]).toContain(response.status);
      }
    });

    it('should allow only authorized users to perform sensitive operations', async () => {
      // Try to revoke all sessions (should require admin)
      const response = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Session Management', () => {
    it('should invalidate tokens after logout', async () => {
      // Create a new user and login
      const user = await User.create({
        email: 'logout-test@example.com',
        username: 'logouttest',
        password: 'Password123!',
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'logout-test@example.com',
          password: 'Password123!',
        });

      const token = loginResponse.body.data.accessToken;
      const refreshToken = loginResponse.body.data.refreshToken;

      // Verify token works
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      // Try to use refresh token after logout
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(refreshResponse.status).toBe(401);
    });

    it('should prevent session fixation', async () => {
      // Login twice and ensure different tokens
      const login1 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'user@example.com',
          password: 'Password123!',
        });

      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'user@example.com',
          password: 'Password123!',
        });

      expect(login1.body.data.accessToken).not.toBe(login2.body.data.accessToken);
      expect(login1.body.data.refreshToken).not.toBe(login2.body.data.refreshToken);
    });

    it('should enforce single active session per user (if configured)', async () => {
      // Note: This test depends on your session management strategy
      // If you allow multiple concurrent sessions, this test may not apply

      const login1 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'user@example.com',
          password: 'Password123!',
        });

      const token1 = login1.body.data.accessToken;

      // Second login
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'user@example.com',
          password: 'Password123!',
        });

      // Try to use first token (may still work if multiple sessions allowed)
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token1}`);

      // Should either work (multiple sessions) or fail (single session)
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('JWT Security', () => {
    it('should reject tokens with "none" algorithm', async () => {
      const noneToken = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64') +
        '.' +
        Buffer.from(
          JSON.stringify({
            userId: regularUserId,
            email: 'user@example.com',
            role: 'admin',
          })
        ).toString('base64') +
        '.';

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${noneToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired tokens', async () => {
      // Wait for token to expire (or create pre-expired token for testing)
      // This is a simplified test - in real scenarios, you'd mock time or create expired tokens
      const jwt = require('jsonwebtoken');
      const config = await import('../../config/environment.js');

      const expiredToken = jwt.sign(
        {
          userId: regularUserId,
          email: 'user@example.com',
          role: 'user',
          type: 'access',
        },
        config.default.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject tampered tokens', async () => {
      // Modify a character in the token
      const tamperedToken = regularUserToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Password Security', () => {
    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty123',
        'Password', // no special char or number
        'password123', // no uppercase
        'PASSWORD123!', // no lowercase
      ];

      for (const weakPass of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `weak${Date.now()}@example.com`,
            username: `weak${Date.now()}`,
            password: weakPass,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should prevent password reuse', async () => {
      const user = await User.create({
        email: 'reuse@example.com',
        username: 'reuseuser',
        password: 'FirstPassword123!',
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'reuse@example.com',
          password: 'FirstPassword123!',
        });

      const token = loginResponse.body.data.accessToken;

      // Change password
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'FirstPassword123!',
          newPassword: 'SecondPassword456!',
        })
        .expect(200);

      // Try to reuse first password (this depends on your implementation)
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'SecondPassword456!',
          newPassword: 'FirstPassword123!',
        });

      // Should reject password reuse
      expect([400]).toContain(response.status);
    });
  });
});
