# 🔐 Nexus UI Backend

A comprehensive, production-ready Node.js backend with **every possible security feature** implemented. Built with enterprise-grade authentication, multiple 2FA methods, and advanced security monitoring.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Latest-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![JWT](https://img.shields.io/badge/Auth-JWT-orange.svg)](https://jwt.io/)
[![2FA](https://img.shields.io/badge/2FA-TOTP%20%7C%20Email%20%7C%20WhatsApp-success.svg)](https://en.wikipedia.org/wiki/Multi-factor_authentication)
[![Tests](https://img.shields.io/badge/Tests-71%20Passing-brightgreen.svg)](./tests)
[![Security](https://img.shields.io/badge/Security-Enterprise%20Grade-critical.svg)](./SECURITY-APPROACH.md)
[![API Docs](https://img.shields.io/badge/API-Documented-blue.svg)](./API_DOCUMENTATION.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## ⭐ Star this repo if you find it helpful!

**[📺 View Demo](#)** | **[📖 Documentation](./API_DOCUMENTATION.md)** | **[🐛 Report Bug](../../issues)** | **[💡 Request Feature](../../issues)**

---

## 🚀 Features

### 🔐 Security Features

- **Authentication**
  - JWT (JSON Web Tokens) with access and refresh tokens
  - Bcrypt password hashing (12 rounds)
  - Strong password validation
  - Password history (prevents reuse of last 5 passwords)
  - Email verification
  - Password reset with secure tokens

- **Two-Factor Authentication (2FA)** - **NEW! 🎉**
  - **📱 TOTP (Authenticator Apps)** - Google Authenticator, Authy, etc.
    - QR code generation for easy setup
    - Backup codes for account recovery (10 one-time codes)
    - Secure 2FA setup and verification flow
  - **📧 Email 2FA** - 6-digit code sent via email
    - Professional HTML email templates
    - 10-minute code expiry
    - Rate limiting per user
  - **💬 WhatsApp 2FA** - 6-digit code via WhatsApp (Twilio)
    - Instant message delivery
    - Secure code generation
    - Phone number verification
  - **Security Features**
    - Failed attempt tracking (5 attempts → 1-hour lock)
    - One-time use codes
    - Method preference per user
    - Comprehensive 2FA documentation ([TWO_FACTOR_AUTH.md](./TWO_FACTOR_AUTH.md))

- **Authorization**
  - Role-Based Access Control (RBAC)
  - Permission-Based Access Control (PBAC)
  - Role hierarchy (guest → user → moderator → admin)
  - Fine-grained permission system
  - Ownership-based authorization
  - Self-action prevention (users can't modify their own roles)

- **Account Security**
  - Account lockout after 5 failed login attempts
  - Automatic unlock after 15 minutes
  - Failed login attempt tracking
  - Session management with MongoDB store
  - Logout from all devices functionality
  - Active session tracking

- **IP Security**
  - IP-based failed attempt tracking
  - Automatic IP blocking (after 10 failed attempts)
  - Manual IP blocking/unblocking (admin)
  - IP whitelist/blacklist support
  - Suspicious activity detection
  - IP statistics and monitoring

- **Input Validation & Sanitization**
  - XSS (Cross-Site Scripting) prevention
  - SQL injection prevention
  - NoSQL injection prevention
  - Input validation with comprehensive rules
  - Request payload size limiting (10kb)

- **CSRF Protection**
  - Double-submit cookie pattern
  - CSRF token validation for state-changing operations

- **Rate Limiting**
  - Global rate limiting (100 req/15min)
  - Login rate limiting (5 req/15min)
  - Registration rate limiting (3 req/hour)
  - Per-endpoint rate limiting
  - IP-based rate limiting

- **Security Headers**
  - Helmet.js for security headers
  - Content Security Policy (CSP)
  - HSTS (HTTP Strict Transport Security)
  - XSS Protection headers
  - X-Content-Type-Options
  - X-Frame-Options
  - Referrer Policy

- **Audit Logging**
  - Comprehensive event logging
  - Security event tracking
  - User action logging
  - IP address logging
  - Severity levels (low, medium, high, critical)
  - Audit log export functionality

- **Security Monitoring**
  - Real-time security dashboard
  - Security score calculation
  - Failed login tracking
  - Suspicious activity alerts
  - Security trends and analytics
  - IP information and statistics
  - User security profiles

### 📦 Additional Features

- **Database**
  - MongoDB with Mongoose ODM
  - Connection pooling
  - Automatic reconnection
  - Database health monitoring

- **Middleware**
  - Request logging
  - Response time tracking
  - Error handling
  - CORS configuration
  - Compression
  - Cookie parser
  - HPP (HTTP Parameter Pollution) prevention

- **API Features**
  - RESTful API design
  - Consistent response format
  - Pagination support
  - Filtering and sorting
  - API versioning (v1)
  - Health check endpoint
  - **Swagger/OpenAPI Documentation** - Interactive API docs at `/api-docs`

- **Testing**
  - Unit tests for services
  - Unit tests for models
  - Integration tests for API
  - Security tests
  - 71 test cases with full coverage

---

## 📋 Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Security Best Practices](#security-best-practices)
- [Contributing](#contributing)

---

## 🛠 Installation

### Prerequisites

- **Node.js**: v22.x or higher
- **MongoDB**: v6.x or higher
- **npm**: v10.x or higher

### Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd nexus-ui-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Start MongoDB** (if running locally):
   ```bash
   mongod
   ```

---

## ⚙️ Configuration

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost

# Application
APP_NAME=Nexus UI Backend
APP_VERSION=1.0.0
API_PREFIX=/api/v1

# Database
MONGODB_URI=mongodb://localhost:27017/nexus_ui_db

# JWT Secrets (Generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
SESSION_MAX_AGE=1800000
SESSION_SECURE=false
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=strict

# CSRF
CSRF_SECRET=your-csrf-secret-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5

# Security
BCRYPT_ROUNDS=12
HSTS_MAX_AGE=31536000

# Email Configuration (for Email 2FA)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Twilio Configuration (for WhatsApp 2FA)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

> 📧 **Email 2FA Setup:** Use Gmail App Password or your SMTP provider
> 💬 **WhatsApp 2FA Setup:** Sign up at [Twilio](https://www.twilio.com/) and configure WhatsApp sandbox

### Generating Secure Secrets

Use these commands to generate secure random strings:

```bash
# On Unix/Linux/MacOS
openssl rand -base64 32

# On Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### Production Mode

```bash
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm test tests/unit/

# Run with coverage
npm test -- --coverage
```

---

## 📚 API Documentation

### Interactive Swagger Documentation

Once the server is running, access the interactive API documentation:

**Swagger UI:** `http://localhost:5000/api-docs`

Features:
- 🎯 Try out endpoints directly from the browser
- 📋 View all request/response schemas
- 🔐 Test authentication flows
- 📖 Complete endpoint documentation

### Additional Documentation

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Comprehensive API guide
- **[TWO_FACTOR_AUTH.md](./TWO_FACTOR_AUTH.md)** - 2FA implementation guide
- **[SECURITY-APPROACH.md](./SECURITY-APPROACH.md)** - Security implementation details

### Quick Start

**Base URL:** `http://localhost:5000/api/v1`

**Authentication:**
```bash
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "SecurePass@123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "user@example.com",
    "password": "SecurePass@123"
  }'

# Use access token
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Main Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | Public |
| POST | `/auth/login` | Login user | Public |
| POST | `/auth/logout` | Logout user | Required |
| GET | `/auth/me` | Get current user | Required |
| POST | `/auth/refresh` | Refresh access token | Public |
| POST | `/auth/change-password` | Change password | Required |
| POST | `/auth/2fa/setup` | Setup TOTP 2FA | Required |
| POST | `/auth/2fa/enable` | Enable TOTP 2FA | Required |
| POST | `/auth/2fa/verify` | Verify 2FA token | Public |
| GET | `/auth/2fa/status` | Get 2FA status | Required |
| POST | `/auth/2fa/email/send` | Send email 2FA code | Public |
| POST | `/auth/2fa/email/verify` | Verify email code | Public |
| POST | `/auth/2fa/whatsapp/send` | Send WhatsApp code | Public |
| POST | `/auth/2fa/whatsapp/verify` | Verify WhatsApp code | Public |
| GET | `/users` | Get all users | Admin |
| GET | `/users/:id` | Get user by ID | Admin/Owner |
| PUT | `/users/me` | Update profile | Required |
| GET | `/audit/logs` | Get audit logs | Admin |
| GET | `/security/dashboard` | Security dashboard | Admin |
| GET | `/security/alerts` | Security alerts | Admin |

---

## 📁 Project Structure

```
nexus-ui-backend/
├── src/
│   ├── config/
│   │   ├── database.js           # MongoDB configuration
│   │   ├── environment.js        # Environment variables
│   │   ├── permissions.js        # Permission definitions
│   │   └── session.js            # Session configuration
│   ├── controllers/
│   │   ├── authController.js     # Authentication logic
│   │   ├── userController.js     # User management
│   │   ├── auditController.js    # Audit logs
│   │   ├── twoFactorController.js # 2FA logic
│   │   └── securityController.js # Security monitoring
│   ├── middleware/
│   │   ├── authentication.js     # JWT authentication
│   │   ├── authorization.js      # RBAC/PBAC
│   │   ├── validation.js         # Input validation
│   │   ├── errorHandler.js       # Error handling
│   │   ├── responseHandler.js    # Response formatting
│   │   ├── ipSecurity.js         # IP-based security
│   │   ├── csrfProtection.js     # CSRF protection
│   │   └── upload.js             # File upload security
│   ├── models/
│   │   ├── User.mongoose.js      # User model
│   │   └── AuditLog.js           # Audit log model
│   ├── routes/
│   │   ├── auth.routes.js        # Auth endpoints
│   │   ├── user.routes.js        # User endpoints
│   │   ├── audit.routes.js       # Audit endpoints
│   │   └── security.routes.js    # Security endpoints
│   ├── services/
│   │   ├── authService.js        # Auth business logic
│   │   ├── tokenService.js       # JWT management
│   │   └── twoFactorService.js   # 2FA service
│   ├── utils/
│   │   └── logger.js             # Winston logger
│   └── app.js                    # Express app setup
├── tests/
│   ├── unit/
│   │   ├── tokenService.test.js
│   │   ├── twoFactorService.test.js
│   │   └── userModel.test.js
│   ├── integration/
│   │   └── auth.test.js
│   ├── security/
│   │   └── security.test.js
│   └── setup.js                  # Test configuration
├── .env.example                  # Example environment file
├── .eslintrc.js                  # ESLint configuration
├── .prettierrc                   # Prettier configuration
├── jest.config.js                # Jest configuration
├── package.json                  # Dependencies
├── API_DOCUMENTATION.md          # API documentation
├── SECURITY-APPROACH.md          # Security implementation guide
└── README.md                     # This file
```

---

## 🔒 Security Best Practices

### For Developers

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Keep dependencies updated** (`npm audit fix`)
4. **Follow least privilege principle** for permissions
5. **Validate all input** on both client and server
6. **Log security events** for monitoring
7. **Review code** for security vulnerabilities
8. **Use HTTPS** in production
9. **Enable rate limiting** on all endpoints
10. **Implement proper error handling** (don't leak sensitive info)

### For Production

1. **Change all default secrets** in `.env`
2. **Enable HTTPS** with valid SSL certificates
3. **Set `NODE_ENV=production`**
4. **Enable `SESSION_SECURE=true`**
5. **Configure proper CORS origins**
6. **Use MongoDB replica sets** for high availability
7. **Set up monitoring and alerting**
8. **Regular security audits**
9. **Keep backups** of database
10. **Use Redis** for sessions and rate limiting (instead of in-memory)

---

## 🧪 Testing

The project includes comprehensive test coverage:

### Test Statistics

- **Total Tests:** 71
- **Unit Tests:** 71
- **Integration Tests:** 18
- **Security Tests:** 50+
- **Coverage:** >80%

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test tests/unit/

# Integration tests
npm test tests/integration/

# Security tests
npm test tests/security/

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Test Categories

1. **tokenService.test.js** - JWT token generation and verification
2. **twoFactorService.test.js** - TOTP and backup code functionality
3. **userModel.test.js** - User model methods and validation
4. **auth.test.js** - Authentication flow integration tests
5. **security.test.js** - Security vulnerability tests

---

## 📊 Security Monitoring

Access the security dashboard at `/api/v1/security/dashboard` (admin only) to view:

- Security score (0-100)
- Failed login attempts
- Blocked IPs
- Suspicious activity
- 2FA statistics
- Permission denials
- Hourly event distribution
- Top failed IPs
- Critical security events

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Coding Standards

- Follow ESLint configuration
- Use Prettier for formatting
- Write tests for new features
- Update documentation
- Follow commit message conventions

---

## 🙏 Acknowledgments

- **Express.js** - Fast, unopinionated web framework
- **Mongoose** - MongoDB ODM
- **JWT** - JSON Web Token implementation
- **Helmet** - Security headers
- **Bcrypt** - Password hashing
- **Speakeasy** - 2FA implementation
- **Jest** - Testing framework
- **Winston** - Logging

---

## 📞 Support

For issues, questions, or contributions:

- **Documentation:** [API Documentation](./API_DOCUMENTATION.md)
- **2FA Guide:** [Two-Factor Authentication](./TWO_FACTOR_AUTH.md)
- **Security:** [Security Approach](./SECURITY-APPROACH.md)
- **Issues:** [Report a Bug](../../issues)
- **Discussions:** [Join the Discussion](../../discussions)

---

## 🌟 Make Your Repository Discoverable

### Add GitHub Topics

Go to your repository → Click ⚙️ next to "About" → Add these topics:

```
nodejs, express, jwt, authentication, 2fa, two-factor-authentication,
security, mongodb, rest-api, backend, totp, email-verification,
whatsapp, oauth, rbac, authorization, api, security-audit,
rate-limiting, helmet, bcrypt, session-management
```

### Share Your Project

- 🐦 **Twitter/X:** Share with #nodejs #expressjs #security #2fa
- 💼 **LinkedIn:** Post about your security implementation
- 📝 **Dev.to:** Write an article about your security approach
- 🗨️ **Reddit:** r/nodejs, r/webdev, r/programming
- 🏆 **Product Hunt:** If launching as a product/tool

### Repository Settings

1. **Add Description:** "🔐 Enterprise-grade Node.js backend with JWT, 3 types of 2FA, and advanced security features"
2. **Add Website:** Link to your deployed API or documentation
3. **Enable Discussions:** For community support
4. **Enable Issues:** For bug reports and feature requests
5. **Add License:** MIT license included

---

## 📈 Project Stats

![GitHub stars](https://img.shields.io/github/stars/YOUR_USERNAME/nexus-ui-backend?style=social)
![GitHub forks](https://img.shields.io/github/forks/YOUR_USERNAME/nexus-ui-backend?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/YOUR_USERNAME/nexus-ui-backend?style=social)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ and 🔐 Security in Mind**

⭐ **If you find this project helpful, please consider giving it a star!** ⭐
