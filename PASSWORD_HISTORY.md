# Password History Tracking

This document explains the password history tracking implementation for preventing password reuse and enforcing password rotation policies.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [How It Works](#how-it-works)
5. [API Endpoints](#api-endpoints)
6. [User Experience](#user-experience)
7. [Admin Management](#admin-management)
8. [Security Best Practices](#security-best-practices)
9. [Compliance](#compliance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Password history tracking prevents users from reusing their recent passwords, enforcing better security hygiene and reducing the risk of compromised accounts.

### Why Password History?

- **Prevents Password Reuse** - Users cannot immediately revert to a compromised password
- **Reduces Risk** - Forces creation of genuinely new passwords
- **Compliance** - Meets requirements for PCI-DSS, HIPAA, and NIST standards
- **Audit Trail** - Track when passwords were changed
- **Account Recovery** - Admins can verify password change patterns

---

## Features

### ✅ Implemented Features

1. **History Tracking** - Last 5 passwords are stored (hashed)
2. **Reuse Prevention** - Users cannot reuse any of their last 5 passwords
3. **Automatic Enforcement** - Checked during:
   - Password change (authenticated user)
   - Password reset (forgot password flow)
4. **Admin Controls**:
   - View password history metadata
   - Force password change on next login
   - Unlock locked accounts
   - View user security summary
   - Revoke all user sessions
5. **Security Logging** - All password changes are logged for audit

### Password Policy Configuration

```javascript
{
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  historyCount: 5,              // Remember last 5 passwords
  expirationDays: null,         // No automatic expiration
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
}
```

---

## Configuration

### Environment Variables

No additional environment variables needed. Configuration is in the User model.

### Customizing History Count

To change the number of passwords remembered, edit `src/models/User.mongoose.js`:

```javascript
// Keep only last 5 passwords (line 184)
if (this.passwordHistory.length > 5) {
  this.passwordHistory = this.passwordHistory.slice(-5);
}

// To keep 10 passwords instead:
if (this.passwordHistory.length > 10) {
  this.passwordHistory = this.passwordHistory.slice(-10);
}
```

---

## How It Works

### 1. Password Storage

When a user saves a new password:

```javascript
// Pre-save middleware (src/models/User.mongoose.js:166-194)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  // Hash password
  const salt = await bcrypt.genSalt(config.bcrypt.rounds);
  this.password = await bcrypt.hash(this.password, salt);

  // Add to password history
  this.passwordHistory.push(this.password);

  // Keep only last 5 passwords
  if (this.passwordHistory.length > 5) {
    this.passwordHistory = this.passwordHistory.slice(-5);
  }

  this.lastPasswordChange = new Date();
  next();
});
```

**Important Notes:**
- Passwords are hashed before being added to history
- Only the hash is stored (never plaintext)
- History is limited to last 5 passwords
- `lastPasswordChange` timestamp is updated

### 2. Password Reuse Check

When user attempts to change password:

```javascript
// Instance method (src/models/User.mongoose.js:229-241)
userSchema.methods.isPasswordInHistory = async function (password) {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }

  for (const oldHash of this.passwordHistory) {
    const isMatch = await bcrypt.compare(password, oldHash);
    if (isMatch) {
      return true; // Password was used before!
    }
  }
  return false;
};
```

**Enforcement in AuthService:**

```javascript
// Change Password (src/services/authService.js:339-387)
static async changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId);

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Validate new password strength
  const passwordValidation = User.validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors.join(', '));
  }

  // ✅ CHECK PASSWORD HISTORY
  const isInHistory = await user.isPasswordInHistory(newPassword);
  if (isInHistory) {
    throw new Error('Cannot reuse previous passwords');
  }

  // Update password
  user.password = newPassword; // Will trigger pre-save hook
  await user.save();
}
```

### 3. Force Password Change

Admins can force users to change passwords on next login:

```javascript
// Admin Security Controller (src/controllers/adminSecurityController.js:52-89)
static async forcePasswordChange(req, res) {
  const user = await User.findById(userId);

  // Mark user as requiring password change
  user.requirePasswordChange = true;
  await user.save();

  // Revoke all tokens to force re-login
  TokenService.revokeAllUserTokens(userId);
}
```

---

## API Endpoints

### User Endpoints

#### Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again."
}
```

**Error (Password in History):**
```json
{
  "success": false,
  "message": "Cannot reuse previous passwords"
}
```

#### Reset Password
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "resetToken": "abc123...",
  "newPassword": "NewSecurePass456!"
}
```

### Admin Endpoints

All admin endpoints require `admin` role.

#### Get Password History Metadata
```http
GET /api/v1/admin/security/users/{userId}/password-history
Authorization: Bearer {adminAccessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "lastPasswordChange": "2024-10-15T10:30:00.000Z",
    "maxHistorySize": 5
  }
}
```

#### Force Password Change
```http
POST /api/v1/admin/security/users/{userId}/force-password-change
Authorization: Bearer {adminAccessToken}
```

**Response:**
```json
{
  "success": true,
  "message": "User will be required to change password on next login"
}
```

#### Get User Security Summary
```http
GET /api/v1/admin/security/users/{userId}/summary
Authorization: Bearer {adminAccessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "johndoe",
    "isActive": true,
    "isLocked": false,
    "isEmailVerified": true,
    "authProvider": "local",
    "loginAttempts": 0,
    "lastLogin": "2024-10-15T10:30:00.000Z",
    "lastPasswordChange": "2024-10-01T08:15:00.000Z",
    "passwordHistoryCount": 5,
    "activeSessions": 2,
    "twoFactorEnabled": false
  }
}
```

#### Unlock Account
```http
POST /api/v1/admin/security/users/{userId}/unlock
Authorization: Bearer {adminAccessToken}
```

#### Revoke All Sessions
```http
POST /api/v1/admin/security/users/{userId}/revoke-sessions
Authorization: Bearer {adminAccessToken}
```

#### Get Password Policy
```http
GET /api/v1/admin/security/password-policy
Authorization: Bearer {adminAccessToken}
```

#### Get Security Statistics
```http
GET /api/v1/admin/security/stats
Authorization: Bearer {adminAccessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalActiveUsers": 1523,
    "lockedAccounts": 12,
    "unverifiedEmails": 45,
    "oauthUsers": 342,
    "localUsers": 1181,
    "timestamp": "2024-10-15T14:20:00.000Z"
  }
}
```

#### Bulk Unlock Accounts
```http
POST /api/v1/admin/security/bulk-unlock
Authorization: Bearer {adminAccessToken}
```

---

## User Experience

### Scenario 1: Normal Password Change

1. User clicks "Change Password"
2. Enters current password
3. Enters new password
4. ✅ New password accepted (not in history)
5. All sessions invalidated
6. User redirected to login

### Scenario 2: Attempting Password Reuse

1. User tries to change password
2. Enters new password that was used 2 months ago
3. ❌ Error: "Cannot reuse previous passwords"
4. User must choose a different password
5. System checks against last 5 passwords

### Scenario 3: Admin Forces Password Change

1. Admin marks user account requiring password change
2. User's sessions are revoked
3. User attempts to login
4. User is prompted: "You must change your password"
5. User cannot proceed until password is changed

### Scenario 4: Forgot Password Flow

1. User requests password reset
2. Receives reset link via email
3. Enters new password
4. ✅ System checks password history
5. ❌ Rejects if password was used before
6. User must choose a genuinely new password

---

## Admin Management

### View User Password History

```bash
# Get password history metadata
curl -X GET http://localhost:3000/api/v1/admin/security/users/{userId}/password-history \
  -H "Authorization: Bearer {adminToken}"
```

**Note:** Actual password hashes are never returned (security). Only metadata is shown:
- Number of passwords in history
- Last password change date
- Maximum history size

### Force Password Change

When to use:
- Security incident detected
- User account potentially compromised
- Compliance requirement (e.g., periodic password rotation)
- User requested account security review

```bash
curl -X POST http://localhost:3000/api/v1/admin/security/users/{userId}/force-password-change \
  -H "Authorization: Bearer {adminToken}"
```

**What happens:**
1. `requirePasswordChange` flag set to `true`
2. All user's refresh tokens revoked
3. User forced to re-login
4. On login, redirect to password change page
5. User cannot proceed until password changed

### Security Summary Dashboard

Get comprehensive security status:

```bash
curl -X GET http://localhost:3000/api/v1/admin/security/users/{userId}/summary \
  -H "Authorization: Bearer {adminToken}"
```

**Use cases:**
- Security audit
- Investigating suspicious activity
- Compliance reporting
- Account recovery support

---

## Security Best Practices

### 1. Never Log Plaintext Passwords

```javascript
// ❌ BAD
logger.info(`User changed password to: ${newPassword}`);

// ✅ GOOD
logger.info(`User ${userId} changed password successfully`);
logSecurityEvent('PASSWORD_CHANGED', { userId, email });
```

### 2. Always Hash Before Storing

```javascript
// ✅ Handled automatically by pre-save middleware
// Never store plaintext passwords in passwordHistory
```

### 3. Use Timing-Safe Comparison

```javascript
// ✅ bcrypt.compare uses timing-safe comparison
const isMatch = await bcrypt.compare(password, oldHash);
```

### 4. Limit History Size

```javascript
// ✅ Keep only last 5 passwords
// Don't store unlimited history (storage + performance)
if (this.passwordHistory.length > 5) {
  this.passwordHistory = this.passwordHistory.slice(-5);
}
```

### 5. Validate Password Strength

```javascript
// ✅ Always validate before accepting
const passwordValidation = User.validatePasswordStrength(newPassword);
if (!passwordValidation.isValid) {
  throw new Error(passwordValidation.errors.join(', '));
}
```

### 6. Log Security Events

```javascript
// ✅ Log all password changes
logSecurityEvent('PASSWORD_CHANGED', {
  userId,
  email: user.email,
  timestamp: new Date(),
});

// ✅ Log failed attempts
logSecurityEvent('PASSWORD_CHANGE_FAILED', {
  userId,
  reason: 'Password in history',
});
```

### 7. Revoke Sessions on Password Change

```javascript
// ✅ Force re-login after password change
TokenService.revokeAllUserTokens(userId);
```

---

## Compliance

### PCI-DSS Requirements

**Requirement 8.2.5:** Users must change passwords at least every 90 days and cannot reuse last 4 passwords.

✅ **Our Implementation:**
- Remembers last 5 passwords (exceeds requirement)
- Admin can force password change
- Can configure expiration (currently disabled)

### NIST SP 800-63B

**Section 5.1.1.2:** Verifiers should not require users to change passwords periodically, but should check against previous passwords when changed.

✅ **Our Implementation:**
- No forced periodic change (NIST recommendation)
- Checks against password history on change
- Prevents reuse of last 5 passwords

### HIPAA Security Rule

**§ 164.308(a)(5)(ii)(D):** Implement procedures for creating, changing, and safeguarding passwords.

✅ **Our Implementation:**
- Strong password requirements
- Password history tracking
- Audit logging of all changes
- Admin controls for management

---

## Troubleshooting

### Issue: User Cannot Change Password (Already Used)

**Error:** "Cannot reuse previous passwords"

**Solution:**
1. User must choose a completely different password
2. Password cannot match any of last 5 passwords
3. If user insists they haven't used this password before:
   - Check password history count: May have used it 3-4 changes ago
   - Admin can view history metadata to confirm

### Issue: Password Change Not Taking Effect

**Problem:** User changes password but can still login with old password

**Causes:**
1. Password not being saved properly
2. Pre-save middleware not triggering
3. Database update failed

**Debug:**
```javascript
// Check if pre-save is triggering
console.log('Password modified:', this.isModified('password'));

// Check if save completed
const saved = await user.save();
console.log('Save result:', saved);
```

### Issue: History Not Updating

**Problem:** Password history array not growing

**Causes:**
1. Using `User.update()` instead of `user.save()`
2. Middleware not executing

**Solution:**
```javascript
// ❌ BAD - Bypasses middleware
await User.update(userId, { password: newPassword });

// ✅ GOOD - Triggers middleware
const user = await User.findById(userId);
user.password = newPassword;
await user.save();
```

### Issue: Admin Cannot View Password History

**Error:** 404 or "User not found"

**Solutions:**
1. Verify user ID is correct
2. Check admin has proper role:
   ```javascript
   // Must have 'admin' role
   user.role === 'admin'
   ```
3. Check authorization middleware:
   ```javascript
   authorize(['admin'])
   ```

---

## Testing Password History

### Manual Testing

1. **Register new user**
   ```bash
   POST /api/v1/auth/register
   {
     "email": "test@example.com",
     "username": "testuser",
     "password": "Password1!",
     "firstName": "Test",
     "lastName": "User"
   }
   ```

2. **Change password 5 times**
   ```bash
   # Change 1
   POST /api/v1/auth/change-password
   { "currentPassword": "Password1!", "newPassword": "Password2!" }

   # Change 2
   { "currentPassword": "Password2!", "newPassword": "Password3!" }

   # ... continue up to Password6!
   ```

3. **Try to reuse Password2!**
   ```bash
   POST /api/v1/auth/change-password
   { "currentPassword": "Password6!", "newPassword": "Password2!" }

   # Expected: ❌ Error "Cannot reuse previous passwords"
   ```

4. **Try to reuse Password1! (oldest)**
   ```bash
   # If only keeping 5 passwords, Password1! should now be forgotten
   # Expected: ✅ Success (if history is 5, Password1! was pushed out)
   ```

### Automated Testing

See `src/tests/unit/user.model.test.js` for comprehensive password history tests:

```javascript
describe('Password History', () => {
  test('Should track last 5 passwords');
  test('Should prevent password reuse');
  test('Should allow reusing password after it leaves history');
  test('Should update lastPasswordChange timestamp');
});
```

---

## Implementation Checklist

- [x] Password history array in User model
- [x] Pre-save middleware to add passwords to history
- [x] Limit history to 5 passwords
- [x] `isPasswordInHistory()` method
- [x] Password history check in `changePassword()`
- [x] Password history check in `resetPassword()`
- [x] Admin endpoint: View password history metadata
- [x] Admin endpoint: Force password change
- [x] Admin endpoint: Get security summary
- [x] Admin endpoint: Unlock account
- [x] Admin endpoint: Revoke sessions
- [x] Admin endpoint: Password policy config
- [x] Admin endpoint: Security statistics
- [x] Security event logging
- [x] Swagger documentation
- [x] Unit tests for password history
- [x] Integration tests for password change
- [x] Comprehensive documentation

---

## Future Enhancements

### Potential Improvements

1. **Password Expiration**
   - Force password change after X days
   - Configurable expiration policy per role

2. **Password Complexity Score**
   - Use zxcvbn for password strength scoring
   - Require minimum complexity score

3. **Breach Detection**
   - Check against Have I Been Pwned API
   - Reject compromised passwords

4. **Multi-Tenancy Support**
   - Per-organization password policies
   - Custom history count per tenant

5. **Password Change Notifications**
   - Email notification on password change
   - SMS/2FA notification for security

---

## Resources

- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)

---

**Last Updated:** October 2024

**Password Policy:**
- Minimum Length: 8 characters
- History Count: 5 passwords
- Lockout: 5 failed attempts, 15-minute lockout
- Strong password requirements enforced
