# Nexus UI Backend API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Audit Logs](#audit-log-endpoints)
  - [Security Monitoring](#security-monitoring-endpoints)
  - [Two-Factor Authentication](#two-factor-authentication-endpoints)

---

## Overview

**Base URL:** `http://localhost:5000/api/v1`

**Content Type:** `application/json`

**API Version:** 1.0.0

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

For errors:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ] // Optional validation errors
}
```

---

## Authentication

### JWT Token-Based Authentication

The API uses JWT (JSON Web Tokens) for authentication. After successful login or registration, you receive:

- **Access Token**: Short-lived token (15 minutes) for API requests
- **Refresh Token**: Long-lived token (7 days) to obtain new access tokens

### Using Access Tokens

Include the access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Refresh

When the access token expires, use the refresh token to obtain a new one via `/api/v1/auth/refresh`.

---

## Authorization

### Roles

The system supports four roles with hierarchical permissions:

1. **guest** - Limited read access
2. **user** - Standard user access
3. **moderator** - Enhanced access with moderation capabilities
4. **admin** - Full system access

### Permissions

Permissions are role-based:
- `user:read`, `user:create`, `user:update`, `user:delete`
- `profile:read`, `profile:update`
- `audit:read`, `audit:list`, `audit:export`
- `role:assign`, `role:revoke`
- And more...

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 423 | Locked - Account locked |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

---

## API Endpoints

## Authentication Endpoints

### Register User

**POST** `/api/v1/auth/register`

Create a new user account.

**Rate Limit:** 3 requests per hour per IP

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation:**
- Email: Valid email format, unique
- Username: 3-30 characters, unique
- Password: Minimum 8 characters, must contain uppercase, lowercase, number, and special character

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "isActive": true,
      "createdAt": "2025-10-16T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m"
  }
}
```

---

### Login

**POST** `/api/v1/auth/login`

Authenticate user and receive tokens.

**Rate Limit:** 5 requests per 15 minutes per IP

**Request Body:**
```json
{
  "emailOrUsername": "user@example.com",
  "password": "SecurePass@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m",
    "requires2FA": false
  }
}
```

**Response (200) - 2FA Required:**
```json
{
  "success": true,
  "message": "2FA verification required",
  "requires2FA": true
}
```

**Error (401) - Invalid Credentials:**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Error (423) - Account Locked:**
```json
{
  "success": false,
  "message": "Account is locked due to too many failed attempts"
}
```

---

### Refresh Token

**POST** `/api/v1/auth/refresh`

Obtain a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m"
  }
}
```

---

### Logout

**POST** `/api/v1/auth/logout`

Revoke refresh token and logout.

**Authentication:** Required (Refresh Token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### Logout from All Devices

**POST** `/api/v1/auth/logout-all`

Revoke all refresh tokens for the authenticated user.

**Authentication:** Required (Access Token)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

---

### Get Current User

**GET** `/api/v1/auth/me`

Get authenticated user's information.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "twoFactorEnabled": false,
      "lastLogin": "2025-10-16T10:00:00.000Z"
    }
  }
}
```

---

### Change Password

**POST** `/api/v1/auth/change-password`

Change the authenticated user's password.

**Authentication:** Required

**Request Body:**
```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error (401) - Invalid Password:**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

---

### Forgot Password

**POST** `/api/v1/auth/forgot-password`

Request password reset email.

**Rate Limit:** 5 requests per 15 minutes

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### Reset Password

**POST** `/api/v1/auth/reset-password`

Reset password using reset token from email.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewPass@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

### Get Active Sessions

**GET** `/api/v1/auth/sessions`

Get list of active sessions for authenticated user.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "tokenId": "token_id",
        "createdAt": "2025-10-16T10:00:00.000Z",
        "expiresAt": "2025-10-23T10:00:00.000Z",
        "isRevoked": false
      }
    ]
  }
}
```

---

## Two-Factor Authentication Endpoints

### Setup 2FA

**POST** `/api/v1/auth/2fa/setup`

Generate 2FA secret and QR code.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "message": "2FA setup initiated. Scan QR code with your authenticator app.",
  "data": {
    "secret": "BASE32_SECRET",
    "qrCode": "data:image/png;base64,..."
  }
}
```

---

### Enable 2FA

**POST** `/api/v1/auth/2fa/enable`

Enable 2FA after verifying TOTP token.

**Authentication:** Required

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "2FA has been enabled successfully",
  "data": {
    "backupCodes": [
      "ABCD1234",
      "EFGH5678",
      ...
    ]
  }
}
```

---

### Disable 2FA

**POST** `/api/v1/auth/2fa/disable`

Disable 2FA (requires password).

**Authentication:** Required

**Request Body:**
```json
{
  "password": "SecurePass@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "2FA has been disabled"
}
```

---

### Verify 2FA

**POST** `/api/v1/auth/2fa/verify`

Verify 2FA token during login.

**Request Body:**
```json
{
  "token": "123456"
}
```

Or with backup code:
```json
{
  "backupCode": "ABCD1234"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "2FA verification successful",
  "data": {
    "user": { ... }
  }
}
```

---

### Get 2FA Status

**GET** `/api/v1/auth/2fa/status`

Check if 2FA is enabled for authenticated user.

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "backupCodesRemaining": 8
  }
}
```

---

## User Endpoints

### Get All Users

**GET** `/api/v1/users`

Get list of all users (Admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `role` (optional): Filter by role
- `isActive` (optional): Filter by active status

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

---

### Get User by ID

**GET** `/api/v1/users/:userId`

Get specific user details.

**Authentication:** Required (Admin or own profile)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

---

### Update User Profile

**PUT** `/api/v1/users/me`

Update authenticated user's profile.

**Authentication:** Required

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { ... }
  }
}
```

---

### Delete User

**DELETE** `/api/v1/users/:userId`

Delete user account (Admin only).

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### Assign Role

**POST** `/api/v1/users/:userId/role`

Assign role to user (Admin only).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "role": "moderator"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Role assigned successfully"
}
```

---

## Audit Log Endpoints

### Get All Audit Logs

**GET** `/api/v1/audit/logs`

Get all audit logs (Admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `event`: Filter by event type
- `severity`: Filter by severity
- `startDate`: Filter by start date
- `endDate`: Filter by end date

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [ ... ],
    "pagination": { ... }
  }
}
```

---

### Get User Audit Logs

**GET** `/api/v1/audit/logs/:userId`

Get audit logs for specific user.

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logs": [ ... ]
  }
}
```

---

### Get Security Events

**GET** `/api/v1/audit/security-events`

Get security-related events.

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "events": [ ... ]
  }
}
```

---

### Get Audit Statistics

**GET** `/api/v1/audit/statistics`

Get audit log statistics and analytics.

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "byEvent": { ... },
    "bySeverity": { ... },
    "trends": [ ... ]
  }
}
```

---

### Export Audit Logs

**GET** `/api/v1/audit/export`

Export audit logs (Admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `format`: Export format (json, csv)
- `startDate`: Start date
- `endDate`: End date

**Response (200):**
Returns file download

---

## Security Monitoring Endpoints

### Get Security Dashboard

**GET** `/api/v1/security/dashboard`

Get comprehensive security dashboard (Admin only).

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "securityScore": 85,
    "summary": {
      "last24h": {
        "successfulLogins": 150,
        "failedLogins": 5,
        "accountLockouts": 0,
        "blockedIPs": 2,
        "twoFactorEnabled": 3,
        "twoFactorFailed": 1,
        "permissionDenials": 0,
        "suspiciousActivity": 1
      }
    },
    "topFailedIPs": [ ... ],
    "hourlyDistribution": [ ... ],
    "recentSecurityEvents": [ ... ],
    "criticalEvents": [ ... ]
  }
}
```

---

### Get Security Alerts

**GET** `/api/v1/security/alerts`

Get real-time security alerts (Admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `severity`: Filter by severity (all, low, medium, high, critical)
- `limit`: Number of alerts to return (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "alerts": [ ... ],
    "count": 25
  }
}
```

---

### Get Security Trends

**GET** `/api/v1/security/trends`

Get security trends over time (Admin only).

**Authentication:** Required (Admin)

**Query Parameters:**
- `days`: Number of days (default: 7)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "7 days",
    "dailyStats": [ ... ],
    "eventDistribution": [ ... ],
    "severityDistribution": [ ... ]
  }
}
```

---

### Get IP Information

**GET** `/api/v1/security/ip/:ip`

Get information about specific IP address (Admin only).

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.1",
    "isBlocked": false,
    "failedAttempts": 2,
    "recentActivityCount": 50,
    "lastActivity": "2025-10-16T10:00:00.000Z"
  }
}
```

---

### Block IP Address

**POST** `/api/v1/security/ip/block`

Manually block an IP address (Admin only).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "ip": "192.168.1.1",
  "reason": "Suspicious activity detected"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "IP 192.168.1.1 has been blocked"
}
```

---

### Unblock IP Address

**POST** `/api/v1/security/ip/unblock`

Unblock an IP address (Admin only).

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "ip": "192.168.1.1"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "IP 192.168.1.1 has been unblocked"
}
```

---

### Get User Security Profile

**GET** `/api/v1/security/user/:userId`

Get security profile for specific user (Admin only).

**Authentication:** Required (Admin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "user_id",
    "statistics": {
      "failedLogins": 2,
      "successfulLogins": 50,
      "permissionDenials": 0,
      "twoFactorEnabled": true
    },
    "lastLogin": "2025-10-16T10:00:00.000Z",
    "lastFailedLogin": "2025-10-15T14:00:00.000Z",
    "recentEvents": [ ... ]
  }
}
```

---

## Rate Limiting

Rate limits are applied to prevent abuse:

| Endpoint | Limit |
|----------|-------|
| `/auth/register` | 3 per hour per IP |
| `/auth/login` | 5 per 15 minutes per IP |
| `/auth/forgot-password` | 5 per 15 minutes per IP |
| Global API | 100 requests per 15 minutes per IP |

When rate limited, you'll receive:

**Response (429):**
```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

---

## Security Features

### Implemented Security Measures

1. **JWT Authentication** with access and refresh tokens
2. **Password Security**
   - Bcrypt hashing (12 rounds)
   - Strong password requirements
   - Password history (prevents reuse of last 5 passwords)
3. **Account Lockout** after 5 failed login attempts (15-minute lockout)
4. **IP-Based Security**
   - Failed attempt tracking
   - Automatic IP blocking
   - Suspicious activity detection
5. **Two-Factor Authentication (TOTP)**
6. **Role-Based Access Control (RBAC)**
7. **Permission-Based Authorization**
8. **Input Validation & Sanitization**
   - XSS prevention
   - SQL/NoSQL injection prevention
9. **CSRF Protection**
10. **Rate Limiting**
11. **Security Headers** (via Helmet)
12. **Audit Logging** for all security events
13. **Session Management**

---

## Testing

Comprehensive test coverage including:
- Unit tests for services and models
- Integration tests for API endpoints
- Security tests for vulnerabilities

**Run tests:**
```bash
npm test
```

---

## Support

For issues or questions, please contact the development team or create an issue in the repository.
