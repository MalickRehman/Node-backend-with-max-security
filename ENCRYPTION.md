# Database Encryption Guide

This document explains the field-level encryption implementation for securing sensitive data in the Nexus UI Backend.

## Table of Contents

1. [Overview](#overview)
2. [Encryption Algorithm](#encryption-algorithm)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Mongoose Plugin](#mongoose-plugin)
6. [Best Practices](#best-practices)
7. [Compliance](#compliance)
8. [Key Management](#key-management)
9. [Performance](#performance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The encryption service provides **field-level encryption** for sensitive data stored in MongoDB. This ensures that even if the database is compromised, encrypted fields remain protected.

### What Gets Encrypted?

- Personal Identifiable Information (PII)
- Financial data (credit cards, bank accounts)
- Medical records (HIPAA compliance)
- Authentication secrets
- Any sensitive user data

### Why Field-Level Encryption?

- **Defense in Depth** - Additional layer beyond database-level encryption
- **Selective Encryption** - Only encrypt sensitive fields (performance)
- **Application-Level Control** - Encryption keys managed by application
- **Compliance** - Meet GDPR, HIPAA, PCI-DSS requirements
- **Zero-Knowledge** - Even database admins can't read encrypted data

---

## Encryption Algorithm

### AES-256-GCM

- **Algorithm**: AES (Advanced Encryption Standard)
- **Key Size**: 256 bits
- **Mode**: GCM (Galois/Counter Mode)
- **IV**: 16 bytes (randomly generated per encryption)
- **Authentication**: Built-in authentication tag (prevents tampering)

### Why AES-256-GCM?

✅ **Industry Standard** - NIST approved, widely trusted
✅ **Authenticated Encryption** - Detects tampering
✅ **Performance** - Hardware acceleration on most CPUs
✅ **Security** - No known practical attacks
✅ **Compliance** - Meets all major compliance standards

### Encryption Format

```
iv:authTag:ciphertext
```

Example:
```
1a2b3c4d5e6f:7g8h9i0j1k2l:3m4n5o6p7q8r...
```

All components are hex-encoded for safe storage in MongoDB.

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# Encryption Configuration
ENCRYPTION_KEY=your-32-character-encryption-key-here-must-be-32-chars
ENCRYPTION_ALGORITHM=aes-256-gcm
```

**IMPORTANT:**
- Key must be **exactly 32 characters** for AES-256
- Use a cryptographically secure random string
- **NEVER commit encryption keys to version control**
- Use different keys for dev/staging/production

### Generate Secure Key

```javascript
// Node.js
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('hex').slice(0, 32);
console.log(key);
```

Or use command line:
```bash
openssl rand -base64 32 | head -c 32
```

---

## Usage

### Basic Encryption/Decryption

```javascript
import encryptionService from './services/encryptionService.js';

// Encrypt a string
const encrypted = encryptionService.encrypt('sensitive data');
console.log(encrypted); // "1a2b3c:7g8h9i:3m4n5o..."

// Decrypt
const decrypted = encryptionService.decrypt(encrypted);
console.log(decrypted); // "sensitive data"
```

### Encrypt Objects

```javascript
const user = {
  name: 'John Doe',
  ssn: '123-45-6789',
  email: 'john@example.com',
};

// Encrypt specific fields
const encrypted = encryptionService.encryptObject(user, ['ssn']);
console.log(encrypted);
// {
//   name: 'John Doe',
//   ssn: '1a2b3c4d:7g8h9i0j:3m4n5o6p...',
//   email: 'john@example.com'
// }

// Decrypt
const decrypted = encryptionService.decryptObject(encrypted, ['ssn']);
```

### Encrypt PII (Predefined Fields)

```javascript
const data = {
  ssn: '123-45-6789',
  passportNumber: 'AB1234567',
  creditCardNumber: '4532-1234-5678-9010',
};

const encrypted = encryptionService.encryptPII(data);
const decrypted = encryptionService.decryptPII(encrypted);
```

### Hash for Searching

```javascript
// Hash a value (one-way, for indexing)
const hash = encryptionService.hash('john@example.com');

// Compare hash
const matches = encryptionService.compareHash('john@example.com', hash);
```

### Masking Sensitive Data

```javascript
// Mask credit card
const masked = encryptionService.maskCreditCard('4532123456789010');
console.log(masked); // "************9010"

// Mask SSN
const masked = encryptionService.maskSSN('123-45-6789');
console.log(masked); // "*****6789"

// Mask email
const masked = encryptionService.maskEmail('john.doe@example.com');
console.log(masked); // "jo*****@example.com"

// Custom masking
const masked = encryptionService.mask('secretdata', 4);
console.log(masked); // "******data"
```

### Generate Secure Tokens

```javascript
// Random token (64 chars)
const token = encryptionService.generateToken();

// Secure password (16 chars with all requirements)
const password = encryptionService.generateSecurePassword(16);
```

---

## Mongoose Plugin

### Apply Plugin to Schema

```javascript
import mongoose from 'mongoose';
import { encryptionPlugin } from './utils/encryptionPlugin.js';

const userSchema = new mongoose.Schema({
  email: String,
  phone: String,
  ssn: String,
  creditCard: String,
});

// Apply encryption
userSchema.plugin(encryptionPlugin, {
  fields: ['creditCard'], // Encrypt but not searchable
  searchableFields: ['ssn', 'phone'], // Encrypt + create hash for searching
});

const User = mongoose.model('User', userSchema);
```

### Automatic Encryption/Decryption

```javascript
// Create user - fields are automatically encrypted
const user = new User({
  email: 'john@example.com',
  phone: '555-1234',
  ssn: '123-45-6789',
  creditCard: '4532-1234-5678-9010',
});

await user.save();
// In database: phone, ssn, creditCard are encrypted

// Retrieve user - fields are automatically decrypted
const retrieved = await User.findById(user._id);
console.log(retrieved.ssn); // "123-45-6789" (decrypted)
```

### Search Encrypted Fields

```javascript
// Find by encrypted field (uses hash)
const user = await User.findByEncryptedField('ssn', '123-45-6789');

// Or use the static method directly
const user = await User.findOne({
  ssnHash: encryptionService.hash('123-45-6789'),
});
```

### Get Masked Fields

```javascript
const user = await User.findById(userId);

// Get masked version for display
const masked = user.getMaskedFields();
console.log(masked.ssn); // "*****6789"
console.log(masked.creditCard); // "************9010"
```

---

## Best Practices

### 1. Encrypt Selectively

**DO**: Encrypt only sensitive fields
```javascript
✅ ssn, creditCard, password, bankAccount, medicalRecord
```

**DON'T**: Encrypt everything
```javascript
❌ name, email (if not sensitive), timestamps, IDs
```

### 2. Use Searchable Fields When Needed

```javascript
// Need to search by this field? Use searchableFields
searchableFields: ['ssn', 'email', 'phone']

// Don't need to search? Use regular fields
fields: ['creditCard', 'bankAccount']
```

### 3. Never Log Decrypted Data

```javascript
// BAD ❌
logger.info(`User SSN: ${user.ssn}`);

// GOOD ✅
logger.info(`User SSN: ${encryptionService.mask(user.ssn)}`);
```

### 4. Mask Data in Responses

```javascript
// BAD ❌
res.json({ ssn: user.ssn });

// GOOD ✅
res.json({ ssn: encryptionService.maskSSN(user.ssn) });
```

### 5. Use select: false for Sensitive Fields

```javascript
const userSchema = new mongoose.Schema({
  ssn: {
    type: String,
    select: false, // Never include by default
  },
});

// Explicitly include when needed
const user = await User.findById(id).select('+ssn');
```

### 6. Validate Before Encryption

```javascript
// Validate data before saving
if (!isValidSSN(user.ssn)) {
  throw new Error('Invalid SSN format');
}
await user.save(); // Now encrypt and save
```

### 7. Handle Decryption Errors Gracefully

```javascript
try {
  const decrypted = encryptionService.decrypt(encrypted);
} catch (error) {
  logger.error('Decryption failed:', error);
  // Return null or default value, don't crash
  return null;
}
```

---

## Compliance

### GDPR (General Data Protection Regulation)

✅ **Right to be Forgotten** - Encrypted data can be securely deleted
✅ **Data Minimization** - Only encrypt what's necessary
✅ **Security** - Encryption required for personal data
✅ **Breach Notification** - Encrypted data reduces risk

### HIPAA (Health Insurance Portability and Accountability Act)

✅ **PHI Protection** - Encrypt all Protected Health Information
✅ **Access Controls** - Only authorized apps can decrypt
✅ **Audit Trails** - Log all access to encrypted data
✅ **Data at Rest** - Field-level encryption meets requirements

### PCI-DSS (Payment Card Industry Data Security Standard)

✅ **Requirement 3** - Protect stored cardholder data
✅ **Strong Cryptography** - AES-256 meets standards
✅ **Key Management** - Secure key storage required
✅ **Never Store CVV** - CVV must NEVER be saved (even encrypted)

**Important PCI-DSS Rules:**
```javascript
// ALLOWED ✅
- Card number (encrypted)
- Expiry date (can be encrypted)
- Cardholder name (can be encrypted)
- Last 4 digits (masked, for display)

// NEVER STORE ❌
- CVV/CVC
- Full magnetic stripe data
- PIN
```

---

## Key Management

### Development

```env
# .env (local)
ENCRYPTION_KEY=dev-key-32-characters-long-12
```

### Staging

```env
# .env.staging (not in git!)
ENCRYPTION_KEY=staging-key-32-chars-different
```

### Production

**Option 1: Environment Variables**
```bash
# Set in hosting platform (Heroku, AWS, etc.)
ENCRYPTION_KEY=prod-key-very-secure-32-chars
```

**Option 2: AWS Secrets Manager**
```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secret = await client.send(
  new GetSecretValueCommand({ SecretId: 'prod/encryption-key' })
);
```

**Option 3: HashiCorp Vault**
```javascript
import vault from 'node-vault';

const result = await vault.read('secret/encryption-key');
const key = result.data.key;
```

### Key Rotation

**Steps to rotate encryption keys:**

1. **Generate new key**
2. **Decrypt all data with old key**
3. **Re-encrypt with new key**
4. **Update environment variable**
5. **Restart application**

```javascript
// Key rotation script example
async function rotateEncryptionKey(oldKey, newKey) {
  const users = await User.find({}).select('+ssn +creditCard');

  for (const user of users) {
    // Decrypt with old key
    const decrypted = oldEncryptionService.decrypt(user.ssn);

    // Re-encrypt with new key
    user.ssn = newEncryptionService.encrypt(decrypted);

    await user.save();
  }

  logger.info('Key rotation completed');
}
```

---

## Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Encrypt (small) | <1ms | Single field |
| Encrypt (large) | ~5ms | 1KB data |
| Decrypt (small) | <1ms | Single field |
| Decrypt (large) | ~5ms | 1KB data |
| Hash | <1ms | SHA-256 |

### Optimization Tips

1. **Encrypt Only Sensitive Fields**
   ```javascript
   // ✅ Good - selective encryption
   fields: ['ssn', 'creditCard']

   // ❌ Bad - encrypting everything
   fields: ['name', 'email', 'address', 'phone', ...]
   ```

2. **Use Indexes on Hash Fields**
   ```javascript
   userSchema.index({ ssnHash: 1 });
   ```

3. **Lazy Loading**
   ```javascript
   // Don't load encrypted fields unless needed
   const user = await User.findById(id); // ssn not loaded (select: false)
   const userWithSSN = await User.findById(id).select('+ssn'); // Explicit
   ```

4. **Batch Operations**
   ```javascript
   // ✅ Encrypt multiple fields at once
   const encrypted = encryptionService.encryptObject(data, fields);

   // ❌ Don't encrypt one by one in a loop
   ```

5. **Caching Decrypted Data** (with caution)
   ```javascript
   // Cache in memory for current request only
   req.decryptedData = encryptionService.decrypt(encrypted);

   // Never cache in Redis/database
   ```

---

## Troubleshooting

### Issue: "Encryption key is required"

**Error**: `Error: Encryption key is required`

**Solution**:
1. Check `.env` file has `ENCRYPTION_KEY`
2. Verify key is exactly 32 characters
3. Ensure dotenv is loaded before encryption service

```javascript
// Make sure this is at the top
import dotenv from 'dotenv';
dotenv.config();
```

### Issue: "Failed to decrypt data"

**Error**: `Error: Failed to decrypt data`

**Causes**:
1. Wrong encryption key
2. Corrupted encrypted data
3. Encrypted with different key

**Solutions**:
- Verify `ENCRYPTION_KEY` matches the one used to encrypt
- Check for data corruption in database
- Don't mix dev/prod keys

### Issue: "Invalid encrypted data format"

**Error**: `Error: Invalid encrypted data format`

**Cause**: Data not in `iv:authTag:ciphertext` format

**Solution**:
- Ensure data was encrypted with this service
- Check for accidental string modifications

### Issue: Performance Slow

**Problem**: Encryption/decryption taking too long

**Solutions**:
1. **Reduce Fields**: Don't encrypt non-sensitive data
2. **Lazy Load**: Use `select: false` on encrypted fields
3. **Index Hashes**: Create indexes on hash fields for searching
4. **Batch**: Encrypt multiple fields at once

---

## Security Checklist

- [ ] Encryption key is 32 characters (256 bits)
- [ ] Key is stored securely (env variables, secrets manager)
- [ ] Key is different for dev/staging/production
- [ ] Key is never committed to version control
- [ ] Sensitive fields use `select: false`
- [ ] Never log decrypted sensitive data
- [ ] Mask data in API responses
- [ ] Use HTTPS for all API communications
- [ ] Implement access controls (who can decrypt?)
- [ ] Audit trail for accessing encrypted data
- [ ] Regular key rotation schedule
- [ ] Backup encryption keys securely
- [ ] Test key recovery process
- [ ] Monitor for unauthorized decryption attempts

---

## Example Models

### User Profile with Encryption

```javascript
userProfileSchema.plugin(encryptionPlugin, {
  fields: [
    'driverLicense',
    'passportNumber',
    'bankAccount.accountNumber',
    'creditCard',
  ],
  searchableFields: ['ssn', 'phone'],
});
```

### Medical Records

```javascript
medicalRecordSchema.plugin(encryptionPlugin, {
  fields: [
    'diagnosis',
    'medications',
    'labResults',
    'insuranceNumber',
  ],
  searchableFields: ['patientId'],
});
```

### Payment Information

```javascript
paymentSchema.plugin(encryptionPlugin, {
  fields: [
    'cardNumber',
    'accountNumber',
    'routingNumber',
  ],
  // Never searchable (PCI compliance)
});
```

---

## Resources

- [NIST Encryption Standards](https://csrc.nist.gov/publications/fips)
- [OWASP Cryptographic Storage](https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/)
- [GDPR Encryption](https://gdpr.eu/encryption/)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

**Last Updated:** October 2024

**Encryption**: AES-256-GCM
**Key Size**: 256 bits
**Compliance**: GDPR, HIPAA, PCI-DSS Ready
