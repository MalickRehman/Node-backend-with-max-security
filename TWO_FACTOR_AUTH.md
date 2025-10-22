# Two-Factor Authentication (2FA)

Comprehensive 2FA implementation with multiple verification methods: Authenticator App (TOTP), Email, and WhatsApp.

## Overview

Three 2FA methods available:

1. **📱 Authenticator App (TOTP)** - Google Authenticator, Authy, etc.
2. **📧 Email Verification** - 6-digit code sent to email
3. **💬 WhatsApp** - 6-digit code sent to WhatsApp

## Features

- ✅ Multiple 2FA methods
- ✅ Backup codes for account recovery
- ✅ Failed attempt tracking with auto-lock
- ✅ Time-based code expiry (10 minutes)
- ✅ Rate limiting per method
- ✅ Security event logging
- ✅ QR code generation for TOTP setup

## Quick Start

### 1. Configure Email (for Email 2FA)

Add to `.env`:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

**Gmail Setup:**
1. Enable 2FA on your Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `SMTP_PASSWORD`

### 2. Configure Twilio (for WhatsApp 2FA)

Add to `.env`:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

**Twilio Setup:**
1. Sign up at https://www.twilio.com/
2. Get your Account SID and Auth Token from Dashboard
3. Set up WhatsApp Sandbox: https://www.twilio.com/console/sms/whatsapp/sandbox
4. Get a Twilio phone number for WhatsApp

## API Endpoints

### Authenticator App (TOTP)

#### 1. Enable TOTP 2FA

```http
POST /api/v1/security/2fa/setup
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KG...",
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

#### 2. Verify and Enable

```http
POST /api/v1/security/2fa/verify
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "token": "123456"
}
```

#### 3. Disable TOTP 2FA

```http
POST /api/v1/security/2fa/disable
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "password": "your-password"
}
```

### Email 2FA

#### 1. Request Email Code

```http
POST /api/v1/auth/2fa/email/send
Content-Type: application/json

{
  "email": "user@example.com",
  "userId": "user-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "expiresIn": 600
}
```

#### 2. Verify Email Code

```http
POST /api/v1/auth/2fa/email/verify
Content-Type: application/json

{
  "userId": "user-id-here",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "Verification successful"
}
```

### WhatsApp 2FA

#### 1. Request WhatsApp Code

```http
POST /api/v1/auth/2fa/whatsapp/send
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "userId": "user-id-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to your WhatsApp",
  "expiresIn": 600
}
```

#### 2. Verify WhatsApp Code

```http
POST /api/v1/auth/2fa/whatsapp/verify
Content-Type: application/json

{
  "userId": "user-id-here",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "Verification successful"
}
```

## Integration Examples

### Login Flow with 2FA

```javascript
// Step 1: Regular login
const loginResponse = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { requires2FA, userId, twoFactorMethod } = await loginResponse.json();

if (requires2FA) {
  // Step 2: Request 2FA code based on user's preferred method

  if (twoFactorMethod === 'email') {
    // Send email code
    await fetch('/api/v1/auth/2fa/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email })
    });

    // User enters code from email
    const code = prompt('Enter code from email');

    // Verify code
    const verifyResponse = await fetch('/api/v1/auth/2fa/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code })
    });
  }

  else if (twoFactorMethod === 'whatsapp') {
    // Send WhatsApp code
    await fetch('/api/v1/auth/2fa/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, phoneNumber })
    });

    // User enters code from WhatsApp
    const code = prompt('Enter code from WhatsApp');

    // Verify code
    const verifyResponse = await fetch('/api/v1/auth/2fa/whatsapp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code })
    });
  }

  else if (twoFactorMethod === 'totp') {
    // User enters code from authenticator app
    const token = prompt('Enter code from authenticator app');

    // Verify directly in login
  }
}
```

## Email Templates

Email 2FA codes are sent using professional HTML templates:

**Features:**
- Responsive design
- Security warnings
- Expiry information
- Brand customization

## WhatsApp Messages

WhatsApp messages include:
- Security code
- Expiry time
- Security warnings
- Contact support info

Example message:
```
🔐 Nexus UI Security Code

Hello John!

Your verification code is:

*123456*

This code will expire in *10 minutes*.

⚠️ Security Warning: Never share this code with anyone.
```

## Security Features

### Failed Attempt Tracking

- Tracks failed attempts per user per method
- Locks after 5 failed attempts
- Auto-unlock after 1 hour
- Logs all failed attempts

### Code Expiry

- Email/WhatsApp codes expire in 10 minutes
- Codes deleted after successful verification
- One-time use codes

### Rate Limiting

- Prevents code spam
- Per-user, per-method rate limiting
- Redis-backed tracking

## Backup Codes

When enabling TOTP 2FA, users receive 10 backup codes:

```json
{
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    ...
  ]
}
```

**Usage:**
- One-time use
- Hashed before storage (SHA-256)
- Can be used instead of 2FA code
- Generate new codes after use

## User Model Updates

Add these fields to your User model:

```javascript
{
  // TOTP 2FA
  twoFactorEnabled: Boolean,
  twoFactorSecret: String,
  twoFactorBackupCodes: [String], // Hashed

  // Method preference
  twoFactorMethod: {
    type: String,
    enum: ['totp', 'email', 'whatsapp'],
    default: 'totp'
  },

  // WhatsApp
  phoneNumber: String,
  phoneNumberVerified: Boolean
}
```

## Configuration

### Email Service

Edit `src/services/emailService.js` to customize:
- Email templates
- Sender name
- SMTP settings

### WhatsApp Service

Edit `src/services/whatsappService.js` to customize:
- Message templates
- Phone number validation
- Twilio settings

### 2FA Service

Edit `src/services/twoFactorService.js` to customize:
- Code expiry time (default: 10 minutes)
- Failed attempt limit (default: 5)
- Backup code count (default: 10)
- Lock duration (default: 1 hour)

## Testing

### Test Email 2FA

```bash
# 1. Request code
curl -X POST http://localhost:5000/api/v1/auth/2fa/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "userId": "user-id"
  }'

# 2. Check email for code

# 3. Verify code
curl -X POST http://localhost:5000/api/v1/auth/2fa/email/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "code": "123456"
  }'
```

### Test WhatsApp 2FA

```bash
# 1. Join Twilio WhatsApp Sandbox
# Send "join <sandbox-keyword>" to your Twilio WhatsApp number

# 2. Request code
curl -X POST http://localhost:5000/api/v1/auth/2fa/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "userId": "user-id"
  }'

# 3. Check WhatsApp for code

# 4. Verify code
curl -X POST http://localhost:5000/api/v1/auth/2fa/whatsapp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "code": "123456"
  }'
```

### Test TOTP 2FA

```bash
# 1. Setup 2FA
curl -X POST http://localhost:5000/api/v1/security/2fa/setup \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Scan QR code with Google Authenticator

# 3. Verify and enable
curl -X POST http://localhost:5000/api/v1/security/2fa/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

## Troubleshooting

### Email Not Sending

**Check:**
```bash
# Verify SMTP settings
echo $SMTP_HOST
echo $SMTP_USER

# Test connection
telnet smtp.gmail.com 587
```

**Solutions:**
- Enable "Less secure app access" (Gmail)
- Use App Password instead of account password
- Check firewall rules

### WhatsApp Not Working

**Check:**
- Twilio account status
- WhatsApp sandbox joined
- Phone number format (+country code)
- Twilio balance

**Solutions:**
```bash
# Test Twilio credentials
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

# Check sandbox status
# Visit: https://www.twilio.com/console/sms/whatsapp/sandbox
```

### Codes Expiring Too Fast

Edit `src/services/twoFactorService.js`:

```javascript
const expiresIn = 600; // Change to desired seconds (600 = 10 minutes)
```

### Too Many Failed Attempts

Reset manually:

```javascript
await twoFactorService.resetFailedAttempts(userId, 'email');
await twoFactorService.resetFailedAttempts(userId, 'whatsapp');
```

## Best Practices

1. ✅ Always use HTTPS in production
2. ✅ Store backup codes hashed
3. ✅ Log all 2FA events
4. ✅ Implement account recovery flow
5. ✅ Provide multiple 2FA methods
6. ✅ Clear error messages for users
7. ✅ Monitor failed attempts
8. ✅ Regular security audits
9. ✅ User education about 2FA
10. ✅ Test all methods thoroughly

## Production Checklist

- [ ] Email service configured and tested
- [ ] Twilio account set up (for WhatsApp)
- [ ] Environment variables secured
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Monitoring enabled (Sentry)
- [ ] Backup codes tested
- [ ] Account recovery flow implemented
- [ ] User documentation provided
- [ ] Support team trained

## Resources

- [Google Authenticator](https://support.google.com/accounts/answer/1066447)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [Nodemailer Documentation](https://nodemailer.com/)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)

---

**Last Updated**: October 2024
**Version**: 1.0.0
