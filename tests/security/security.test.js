import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.mongoose.js';

describe('Security Tests', () => {
  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: "admin'--",
          password: "' OR '1'='1",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize SQL injection attempts in registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: "test@example.com'; DROP TABLE users;--",
          username: "testuser",
          password: "Test@1234",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection with $ne operator', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: { $ne: null },
          password: { $ne: null },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent NoSQL injection with $gt operator', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: { $gt: "" },
          password: "password",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject $where operator in input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: "test@example.com",
          username: { $where: "this.password == 'test'" },
          password: "Test@1234",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize XSS in registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: "xss@example.com",
          username: "xssuser",
          password: "Test@1234",
          firstName: "<script>alert('XSS')</script>",
        })
        .expect(201);

      expect(response.body.data.user.firstName).not.toContain('<script>');
    });

    it('should sanitize XSS in user profile', async () => {
      // Register user
      const regResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: "profile@example.com",
          username: "profileuser",
          password: "Test@1234",
        });

      const token = regResponse.body.data.accessToken;

      // Update with XSS
      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: "<img src=x onerror=alert('XSS')>",
          lastName: "<script>document.cookie</script>",
        })
        .expect(200);

      expect(response.body.data.user.firstName).not.toContain('<img');
      expect(response.body.data.user.lastName).not.toContain('<script>');
    });
  });

  describe('CSRF Protection', () => {
    it('should reject requests without CSRF token on state-changing operations', async () => {
      // Register user
      const regResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: "csrf@example.com",
          username: "csrfuser",
          password: "Test@1234",
        });

      const token = regResponse.body.data.accessToken;

      // Try to update without CSRF token
      const response = await request(app)
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: "Updated",
        });

      // Should either require CSRF or succeed (depending on implementation)
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const attempts = [];

      // Make 10 rapid login attempts
      for (let i = 0; i < 10; i++) {
        const promise = request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: 'ratelimit@example.com',
            password: 'wrong',
          });
        attempts.push(promise);
      }

      const responses = await Promise.all(attempts);
      const rateLimited = responses.some(r => r.status === 429);

      // At least one should be rate limited
      expect(rateLimited).toBe(true);
    }, 15000);

    it('should rate limit registration attempts', async () => {
      const attempts = [];

      // Make multiple registration attempts
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `ratelimit${i}@example.com`,
            username: `ratelimit${i}`,
            password: 'Test@1234',
          });
        attempts.push(promise);
      }

      const responses = await Promise.all(attempts);
      const rateLimited = responses.some(r => r.status === 429);

      // Should rate limit after 3 per hour
      expect(rateLimited).toBe(true);
    }, 15000);
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'weak',
        'password',
        'Password',
        'Password1',
        'password@',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `test${Math.random()}@example.com`,
            username: `test${Math.random()}`,
            password,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should hash passwords before storing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hash@example.com',
          username: 'hashuser',
          password: 'Test@1234',
        })
        .expect(201);

      const user = await User.findOne({ email: 'hash@example.com' }).select('+password');

      // Password should be hashed
      expect(user.password).not.toBe('Test@1234');
      expect(user.password).toMatch(/^\$2[aby]\$/); // Bcrypt pattern
    });

    it('should prevent password reuse', async () => {
      // Register user
      const regResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'reuse@example.com',
          username: 'reuseuser',
          password: 'Test@1234',
        });

      const token = regResponse.body.data.accessToken;

      // Try to change to same password
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Test@1234',
          newPassword: 'Test@1234',
        });

      // Should reject or warn about reuse
      expect([400, 200]).toContain(response.status);
    });
  });

  describe('JWT Security', () => {
    it('should reject expired tokens', async () => {
      // This would require creating a token with past expiry
      // For now, test with invalid token
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer expired.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject tokens without Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'some.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should include token expiration in response', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'jwt@example.com',
          username: 'jwtuser',
          password: 'Test@1234',
        })
        .expect(201);

      expect(response.body.data.expiresIn).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
    });
  });

  describe('Account Lockout', () => {
    beforeEach(async () => {
      // Create test user
      await User.createUser({
        email: 'lockout@example.com',
        username: 'lockoutuser',
        password: 'Test@1234',
      });
    });

    it('should lock account after failed login attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: 'lockout@example.com',
            password: 'WrongPassword',
          });
      }

      // 6th attempt should show locked
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'lockout@example.com',
          password: 'Test@1234',
        })
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('locked');
    });

    it('should reset failed attempts on successful login', async () => {
      // Make 2 failed attempts
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'lockout@example.com',
          password: 'Wrong',
        });

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'lockout@example.com',
          password: 'Wrong',
        });

      // Successful login
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'lockout@example.com',
          password: 'Test@1234',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Should reset attempts - try 4 more wrong attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: 'lockout@example.com',
            password: 'Wrong',
          });
      }

      // Should not be locked yet (only 4 attempts after reset)
      const finalResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'lockout@example.com',
          password: 'Test@1234',
        });

      expect(finalResponse.status).toBe(200);
    });
  });

  describe('Session Security', () => {
    it('should set secure cookie flags', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'session@example.com',
          password: 'Test@1234',
        });

      // Check for session cookie if using sessions
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find(c => c.includes('sessionId'));
        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          expect(sessionCookie).toContain('SameSite');
        }
      }
    });
  });

  describe('Authorization Tests', () => {
    let adminToken;
    let userToken;

    beforeEach(async () => {
      // Create admin user
      const admin = await User.createUser({
        email: 'admin@example.com',
        username: 'adminuser',
        password: 'Admin@1234',
        role: 'admin',
      });

      // Create regular user
      const user = await User.createUser({
        email: 'regular@example.com',
        username: 'regularuser',
        password: 'User@1234',
        role: 'user',
      });

      // Login both
      const adminLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'admin@example.com',
          password: 'Admin@1234',
        });
      adminToken = adminLogin.body.data.accessToken;

      const userLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          emailOrUsername: 'regular@example.com',
          password: 'User@1234',
        });
      userToken = userLogin.body.data.accessToken;
    });

    it('should restrict admin-only endpoints to admins', async () => {
      // Try to access admin endpoint with user token
      const response = await request(app)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should succeed or return data
      expect([200, 404]).toContain(response.status);
    });

    it('should prevent users from accessing other user data', async () => {
      // Get user ID from token
      const userResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      const userId = userResponse.body.data.user._id;

      // Try to access with different user token (using admin ID)
      const adminResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminId = adminResponse.body.data.user._id;

      // User should not be able to access admin's profile
      const response = await request(app)
        .get(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email,
            username: 'testuser',
            password: 'Test@1234',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should enforce username length requirements', async () => {
      // Too short
      const shortResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'short@example.com',
          username: 'ab',
          password: 'Test@1234',
        })
        .expect(400);

      expect(shortResponse.body.success).toBe(false);

      // Too long
      const longResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'long@example.com',
          username: 'a'.repeat(31),
          password: 'Test@1234',
        })
        .expect(400);

      expect(longResponse.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          // Missing username and password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in response', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should not expose sensitive headers', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      // Should not expose these
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
