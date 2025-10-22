# Testing Documentation

This document provides a comprehensive guide to the testing suite implemented for the Nexus UI Backend.

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Categories](#test-categories)
5. [Writing Tests](#writing-tests)
6. [Coverage Reports](#coverage-reports)
7. [CI/CD Integration](#cicd-integration)

---

## Overview

The Nexus UI Backend includes a comprehensive security testing suite with:
- **Unit Tests** - Test individual functions and modules
- **Integration Tests** - Test API endpoints and workflows
- **Security Tests** - Test for common vulnerabilities (OWASP Top 10)

### Technologies Used

- **Jest** - Testing framework
- **Supertest** - HTTP assertion library
- **MongoDB Memory Server** - In-memory MongoDB for testing
- **Faker** - Generate fake data for tests

---

## Test Structure

```
src/tests/
├── setup.js                          # Test configuration and setup
├── unit/                             # Unit tests
│   ├── user.model.test.js           # User model tests
│   └── tokenService.test.js          # Token service tests
├── integration/                      # Integration tests
│   └── auth.integration.test.js      # Authentication flow tests
└── security/                         # Security-specific tests
    ├── injection.security.test.js    # Injection attack tests
    └── authorization.security.test.js # Auth & access control tests
```

---

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- src/tests/unit/user.model.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should create"
```

### Run Tests in Verbose Mode

```bash
npm test -- --verbose
```

---

## Test Categories

### 1. Unit Tests

**Purpose:** Test individual components in isolation

**Location:** `src/tests/unit/`

#### User Model Tests (`user.model.test.js`)

- ✅ User creation and validation
- ✅ Password hashing and comparison
- ✅ Password history tracking
- ✅ Account locking after failed attempts
- ✅ Password strength validation
- ✅ Virtual fields (fullName)
- ✅ Static methods (findByEmail, findByUsername)
- ✅ JSON transformation (sensitive field exclusion)
- ✅ OAuth user support

**Example:**
```javascript
it('should hash password before saving', async () => {
  const password = 'TestPassword123!';
  const user = await User.create({
    email: 'test@example.com',
    username: 'testuser',
    password,
  });

  expect(user.password).not.toBe(password);
  expect(user.password).toMatch(/^\$2[aby]\$\d+\$/);
});
```

#### Token Service Tests (`tokenService.test.js`)

- ✅ Access token generation
- ✅ Refresh token generation
- ✅ Token verification
- ✅ Token expiration
- ✅ Token storage and revocation
- ✅ Refresh token rotation
- ✅ Invalid token rejection

**Example:**
```javascript
it('should generate a valid access token', () => {
  const token = tokenService.generateAccessToken(testUser);
  const decoded = jwt.verify(token, config.jwt.secret);

  expect(decoded.userId).toBe(testUser._id.toString());
  expect(decoded.type).toBe('access');
});
```

---

### 2. Integration Tests

**Purpose:** Test complete API workflows

**Location:** `src/tests/integration/`

#### Authentication Integration Tests (`auth.integration.test.js`)

- ✅ User registration flow
- ✅ Login with email/username
- ✅ Token refresh mechanism
- ✅ Logout functionality
- ✅ Get current user endpoint
- ✅ Password change flow
- ✅ Account locking after failed attempts
- ✅ Rate limiting enforcement

**Example:**
```javascript
it('should register a new user successfully', async () => {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'StrongPassword123!',
    })
    .expect(201);

  expect(response.body.success).toBe(true);
  expect(response.body.data.accessToken).toBeDefined();
});
```

---

### 3. Security Tests

**Purpose:** Test for common security vulnerabilities (OWASP Top 10)

**Location:** `src/tests/security/`

#### Injection Attack Tests (`injection.security.test.js`)

Tests protection against:
- ✅ **NoSQL Injection** - MongoDB query injection
- ✅ **SQL Injection** - SQL query injection (if using SQL)
- ✅ **Command Injection** - OS command injection
- ✅ **XSS (Cross-Site Scripting)** - Script injection in HTML
- ✅ **Path Traversal** - Directory traversal attacks
- ✅ **HTTP Parameter Pollution** - Duplicate parameter handling
- ✅ **LDAP Injection** - LDAP query injection
- ✅ **Template Injection** - Template engine exploits
- ✅ **XXE (XML External Entity)** - XML parsing vulnerabilities
- ✅ **Mass Assignment** - Protected field injection
- ✅ **CRLF Injection** - Header injection attacks

**Example:**
```javascript
it('should prevent NoSQL injection in login', async () => {
  const payload = { $gt: '' };

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      emailOrUsername: payload,
      password: 'anything',
    });

  expect(response.status).not.toBe(200);
  expect(response.body.success).toBe(false);
});
```

#### Authorization & Access Control Tests (`authorization.security.test.js`)

Tests protection against:
- ✅ **Role-Based Access Control (RBAC)** - Role enforcement
- ✅ **Horizontal Access Control** - Same-level user isolation
- ✅ **Vertical Access Control** - Privilege escalation prevention
- ✅ **BOLA/IDOR** - Insecure direct object references
- ✅ **Function Level Authorization** - Administrative function protection
- ✅ **Session Management** - Token invalidation and fixation
- ✅ **JWT Security** - Token tampering and algorithm confusion
- ✅ **Password Security** - Complexity and reuse prevention

**Example:**
```javascript
it('should deny regular user access to admin endpoints', async () => {
  const response = await request(app)
    .get('/api/v1/users')
    .set('Authorization', `Bearer ${regularUserToken}`);

  expect([403, 404]).toContain(response.status);
});
```

---

## Writing Tests

### Test File Naming Convention

- Unit tests: `*.test.js` or `*.spec.js`
- Location: Must be in `src/tests/` directory
- Descriptive names: `user.model.test.js`, `auth.integration.test.js`

### Test Structure

```javascript
import request from 'supertest';
import app from '../../app.js';
import User from '../../models/User.mongoose.js';

describe('Feature Name', () => {
  // Setup before all tests
  beforeAll(async () => {
    // One-time setup
  });

  // Setup before each test
  beforeEach(async () => {
    // Per-test setup
  });

  describe('Specific Functionality', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = 'test data';

      // Act
      const result = await someFunction(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });

  // Cleanup after each test
  afterEach(async () => {
    // Per-test cleanup
  });

  // Cleanup after all tests
  afterAll(async () => {
    // One-time cleanup
  });
});
```

### Best Practices

1. **Descriptive Test Names**
   ```javascript
   // Good
   it('should hash password before saving to database')

   // Bad
   it('test password')
   ```

2. **Arrange-Act-Assert Pattern**
   ```javascript
   it('should authenticate user with valid credentials', async () => {
     // Arrange
     const credentials = { email: 'test@example.com', password: 'Test123!' };

     // Act
     const response = await request(app)
       .post('/api/v1/auth/login')
       .send(credentials);

     // Assert
     expect(response.status).toBe(200);
     expect(response.body.data.accessToken).toBeDefined();
   });
   ```

3. **Test One Thing Per Test**
   ```javascript
   // Good - tests one specific behavior
   it('should reject weak passwords', async () => { ... });
   it('should reject duplicate emails', async () => { ... });

   // Bad - tests multiple things
   it('should validate user input', async () => {
     // Tests password, email, username all at once
   });
   ```

4. **Use Factories for Test Data**
   ```javascript
   const createTestUser = async (overrides = {}) => {
     return await User.create({
       email: 'test@example.com',
       username: 'testuser',
       password: 'Password123!',
       ...overrides,
     });
   };
   ```

5. **Clean Up After Tests**
   ```javascript
   afterEach(async () => {
     await User.deleteMany({});
   });
   ```

---

## Coverage Reports

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Output

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   85.23 |    78.45 |   82.34 |   85.67 |
 models/              |   92.15 |    85.23 |   89.45 |   92.34 |
  User.mongoose.js    |   92.15 |    85.23 |   89.45 |   92.34 |
 services/            |   88.67 |    82.34 |   85.67 |   89.12 |
  tokenService.js     |   88.67 |    82.34 |   85.67 |   89.12 |
 controllers/         |   78.45 |    72.34 |   76.89 |   79.12 |
  authController.js   |   78.45 |    72.34 |   76.89 |   79.12 |
----------------------|---------|----------|---------|---------|
```

### Coverage Thresholds

Configured in `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### View HTML Coverage Report

After running coverage, open:
```
coverage/lcov-report/index.html
```

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: Run Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x, 22.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Run coverage
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
```

### GitLab CI Example

Create `.gitlab-ci.yml`:

```yaml
image: node:20

stages:
  - test

test:
  stage: test
  script:
    - npm ci
    - npm test
    - npm run test:coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

---

## Test Environment Configuration

### Environment Variables for Testing

Create `.env.test`:

```env
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key-32-chars-min
JWT_REFRESH_SECRET=test-refresh-secret-32-chars-min
SESSION_SECRET=test-session-secret-32-chars-min
CSRF_SECRET=test-csrf-secret-32-chars-min
ENCRYPTION_KEY=test-encryption-key-32-chars
```

### In-Memory Database

Tests use MongoDB Memory Server for isolation:
- No need for external MongoDB instance
- Fast test execution
- Automatic cleanup
- Data isolation between tests

---

## Debugging Tests

### Run Single Test with Debug

```bash
node --inspect-brk node_modules/.bin/jest --runInBand src/tests/unit/user.model.test.js
```

### Use Chrome DevTools

1. Open `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Set breakpoints in test files
4. Run tests with `--inspect-brk`

### Console Logging in Tests

```javascript
it('should do something', async () => {
  console.log('Debug info:', someVariable);
  // ... test code
});
```

---

## Common Testing Patterns

### Testing Async Code

```javascript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Errors

```javascript
it('should throw error for invalid input', async () => {
  await expect(someFunction('invalid')).rejects.toThrow('Error message');
});
```

### Testing with Mocks

```javascript
jest.mock('../../services/emailService.js');

it('should send email on registration', async () => {
  await registerUser(userData);
  expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({
    to: userData.email,
  }));
});
```

---

## Test Maintenance

### Keep Tests Updated

- Update tests when adding new features
- Refactor tests when refactoring code
- Remove obsolete tests
- Keep test data realistic

### Review Test Coverage

- Run coverage reports regularly
- Identify untested code paths
- Prioritize critical path testing
- Aim for >70% coverage

### Performance

- Keep tests fast (<1s per test ideal)
- Use in-memory databases
- Minimize external dependencies
- Run integration tests separately if slow

---

## Troubleshooting

### Tests Fail Randomly

**Problem:** Tests pass sometimes, fail other times

**Solution:**
- Check for shared state between tests
- Ensure proper cleanup in `afterEach`
- Use unique data for each test

### MongoDB Connection Issues

**Problem:** Cannot connect to MongoDB

**Solution:**
- MongoDB Memory Server creates in-memory instance
- Check `setup.js` configuration
- Ensure proper async/await usage

### Timeout Errors

**Problem:** Tests timeout

**Solution:**
- Increase timeout in `jest.config.js`
- Check for unresolved promises
- Use `done()` callback for async tests

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

**Last Updated:** October 2024

**Test Suite Version:** 1.0.0

**Coverage:** 85%+ (Unit), 80%+ (Integration), 100% (Security)
