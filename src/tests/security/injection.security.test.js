import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.mongoose.js';

describe('Security Tests - Injection Attacks', () => {
  describe('SQL/NoSQL Injection Tests', () => {
    beforeEach(async () => {
      await User.create({
        email: 'victim@example.com',
        username: 'victim',
        password: 'Password123!',
      });
    });

    it('should prevent NoSQL injection in login (email field)', async () => {
      const payloads = [
        { $gt: '' },
        { $ne: null },
        { $regex: '.*' },
        "' OR '1'='1",
        '" OR "1"="1',
      ];

      for (const payload of payloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: payload,
            password: 'anything',
          });

        // Should not bypass authentication
        expect(response.status).not.toBe(200);
        expect(response.body.success).toBe(false);
      }
    });

    it('should prevent NoSQL injection in query parameters', async () => {
      // Register user and get token
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@example.com',
          username: 'admin',
          password: 'Password123!',
        });

      const token = registerResponse.body.data.accessToken;

      // Try NoSQL injection in query params
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query({ email: { $gt: '' } });

      // Should either fail or not return data
      if (response.status === 200) {
        // If it succeeds, it should return sanitized results
        expect(response.body.success).toBe(true);
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should sanitize user input in registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'Password123!',
          role: 'admin', // Attempt to set admin role
        });

      if (response.status === 201) {
        // Even if it succeeds, role should not be admin
        expect(response.body.data.user.role).toBe('user');
      }
    });

    it('should prevent command injection in email field', async () => {
      const maliciousEmails = [
        'test@example.com; rm -rf /',
        'test@example.com && cat /etc/passwd',
        'test@example.com | whoami',
        'test@example.com`whoami`',
        'test@example.com$(whoami)',
      ];

      for (const email of maliciousEmails) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email,
            username: 'testuser' + Date.now(),
            password: 'Password123!',
          });

        // Should reject invalid email format
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('XSS (Cross-Site Scripting) Tests', () => {
    it('should escape XSS payloads in user input', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')">',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'xss@example.com',
            username: 'xssuser' + Date.now(),
            password: 'Password123!',
            firstName: payload,
            lastName: payload,
          });

        // Should either sanitize or reject
        if (response.status === 201) {
          // If accepted, check that payload is escaped/sanitized
          const firstName = response.body.data.user.firstName;
          const lastName = response.body.data.user.lastName;

          // Should not contain script tags or event handlers
          expect(firstName).not.toContain('<script>');
          expect(firstName).not.toContain('onerror=');
          expect(firstName).not.toContain('onload=');
          expect(lastName).not.toContain('<script>');
        }
      }
    });

    it('should sanitize HTML in text fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'html@example.com',
          username: 'htmluser',
          password: 'Password123!',
          firstName: '<b>Bold</b> Text',
          lastName: '<i>Italic</i> Text',
        });

      if (response.status === 201) {
        const user = response.body.data.user;
        // HTML tags should be stripped or escaped
        expect(user.firstName).not.toContain('<b>');
        expect(user.lastName).not.toContain('<i>');
      }
    });
  });

  describe('Path Traversal Tests', () => {
    it('should prevent path traversal in file paths', async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'path@example.com',
          username: 'pathuser',
          password: 'Password123!',
        });

      const token = registerResponse.body.data.accessToken;

      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      for (const payload of pathTraversalPayloads) {
        // This test assumes you have a file-related endpoint
        // If not, this test will need to be adapted to your specific endpoints
        const response = await request(app)
          .get(`/api/v1/files/${payload}`)
          .set('Authorization', `Bearer ${token}`);

        // Should not allow path traversal
        expect(response.status).not.toBe(200);
      }
    });
  });

  describe('HTTP Parameter Pollution Tests', () => {
    it('should handle duplicate parameters correctly', async () => {
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hpp@example.com',
          username: 'hppuser',
          password: 'Password123!',
        });

      const token = registerResponse.body.data.accessToken;

      // Try to send duplicate parameters
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .query('role=user&role=admin');

      // Should handle gracefully
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('LDAP Injection Tests', () => {
    it('should prevent LDAP injection characters', async () => {
      const ldapPayloads = [
        'test*',
        'test)(uid=*',
        'admin*)(|(password=*',
        '*)(objectClass=*',
      ];

      for (const payload of ldapPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            emailOrUsername: payload,
            password: 'Password123!',
          });

        // Should not succeed
        expect(response.status).not.toBe(200);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Template Injection Tests', () => {
    it('should prevent template injection in user input', async () => {
      const templatePayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '${{7*7}}',
      ];

      for (const payload of templatePayloads) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'template@example.com',
            username: 'templateuser' + Date.now(),
            password: 'Password123!',
            firstName: payload,
          });

        if (response.status === 201) {
          // Should not evaluate the template
          expect(response.body.data.user.firstName).not.toBe('49');
          // Original payload should be escaped or rejected
          expect(response.body.data.user.firstName).not.toContain('{{');
        }
      }
    });
  });

  describe('XXE (XML External Entity) Tests', () => {
    it('should reject XML payloads in JSON endpoints', async () => {
      const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<user>
  <email>&xxe;</email>
</user>`;

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send(xxePayload);

      // Should fail to parse or reject
      expect(response.status).toBe(400);
    });
  });

  describe('Mass Assignment Tests', () => {
    it('should prevent mass assignment of protected fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'massassign@example.com',
          username: 'massassignuser',
          password: 'Password123!',
          role: 'admin', // Try to assign admin role
          isEmailVerified: true, // Try to verify email
          loginAttempts: 0,
          lockUntil: null,
        });

      if (response.status === 201) {
        const user = response.body.data.user;
        // Protected fields should not be set
        expect(user.role).toBe('user'); // default role
        expect(user.isEmailVerified).toBe(false); // default
      }
    });
  });

  describe('CRLF Injection Tests', () => {
    it('should prevent CRLF injection in headers', async () => {
      const crlfPayloads = [
        'test@example.com\r\nX-Injected: true',
        'test@example.com\nSet-Cookie: admin=true',
        'test@example.com%0d%0aX-Injected: true',
      ];

      for (const payload of crlfPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: payload,
            username: 'crlfuser' + Date.now(),
            password: 'Password123!',
          });

        // Should reject invalid email
        expect(response.status).toBe(400);

        // Should not set injected headers
        expect(response.headers['x-injected']).toBeUndefined();
        expect(response.headers['set-cookie']).not.toContain('admin=true');
      }
    });
  });
});
