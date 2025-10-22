import crypto from 'crypto';
import config from '../config/environment.js';
import logger from '../utils/logger.js';

/**
 * Encryption Service
 * Provides field-level encryption for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

class EncryptionService {
  constructor() {
    this.algorithm = config.encryption.algorithm;
    this.key = this.deriveKey(config.encryption.key);

    if (!this.key) {
      logger.error('ENCRYPTION_KEY is not configured!');
      throw new Error('Encryption key is required');
    }

    logger.info('✅ Encryption service initialized with AES-256-GCM');
  }

  /**
   * Derive a 32-byte key from the environment key
   */
  deriveKey(keyString) {
    if (!keyString) {
      return null;
    }

    // Ensure the key is exactly 32 bytes for AES-256
    if (keyString.length === 32) {
      return Buffer.from(keyString, 'utf8');
    }

    // Use SHA-256 to derive a 32-byte key
    return crypto.createHash('sha256').update(keyString).digest();
  }

  /**
   * Encrypt a string value
   * @param {string} plaintext - The text to encrypt
   * @returns {string} - Encrypted text in format: iv:authTag:ciphertext (hex encoded)
   */
  encrypt(plaintext) {
    if (!plaintext) {
      return null;
    }

    if (typeof plaintext !== 'string') {
      plaintext = JSON.stringify(plaintext);
    }

    try {
      // Generate a random initialization vector (IV)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag (GCM mode)
      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * @param {string} encryptedData - The encrypted text (iv:authTag:ciphertext format)
   * @returns {string} - Decrypted plaintext
   */
  decrypt(encryptedData) {
    if (!encryptedData) {
      return null;
    }

    try {
      // Parse the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the ciphertext
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object (all string fields)
   * @param {Object} obj - Object to encrypt
   * @param {Array<string>} fields - Fields to encrypt
   * @returns {Object} - Object with encrypted fields
   */
  encryptObject(obj, fields = []) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const encrypted = { ...obj };

    for (const field of fields) {
      if (encrypted[field] !== undefined && encrypted[field] !== null) {
        encrypted[field] = this.encrypt(String(encrypted[field]));
      }
    }

    return encrypted;
  }

  /**
   * Decrypt an object (specified fields)
   * @param {Object} obj - Object with encrypted fields
   * @param {Array<string>} fields - Fields to decrypt
   * @returns {Object} - Object with decrypted fields
   */
  decryptObject(obj, fields = []) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const decrypted = { ...obj };

    for (const field of fields) {
      if (decrypted[field] !== undefined && decrypted[field] !== null) {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          logger.error(`Failed to decrypt field '${field}':`, error);
          decrypted[field] = null; // Set to null if decryption fails
        }
      }
    }

    return decrypted;
  }

  /**
   * Hash a value (one-way, for indexing encrypted fields)
   * @param {string} value - Value to hash
   * @returns {string} - SHA-256 hash (hex)
   */
  hash(value) {
    if (!value) {
      return null;
    }

    return crypto
      .createHash('sha256')
      .update(String(value))
      .digest('hex');
  }

  /**
   * Compare a plaintext value with a hash
   * @param {string} plaintext - The plaintext value
   * @param {string} hash - The hash to compare against
   * @returns {boolean} - True if matches
   */
  compareHash(plaintext, hash) {
    if (!plaintext || !hash) {
      return false;
    }

    const plaintextHash = this.hash(plaintext);
    return crypto.timingSafeEqual(
      Buffer.from(plaintextHash),
      Buffer.from(hash)
    );
  }

  /**
   * Encrypt sensitive PII data
   * Recommended fields: SSN, credit card, bank account, passport, etc.
   */
  encryptPII(data) {
    const piiFields = [
      'ssn',
      'socialSecurityNumber',
      'creditCardNumber',
      'bankAccount',
      'routingNumber',
      'passportNumber',
      'driverLicense',
      'nationalId',
      'taxId',
    ];

    return this.encryptObject(data, piiFields);
  }

  /**
   * Decrypt sensitive PII data
   */
  decryptPII(data) {
    const piiFields = [
      'ssn',
      'socialSecurityNumber',
      'creditCardNumber',
      'bankAccount',
      'routingNumber',
      'passportNumber',
      'driverLicense',
      'nationalId',
      'taxId',
    ];

    return this.decryptObject(data, piiFields);
  }

  /**
   * Encrypt payment information
   */
  encryptPayment(data) {
    const paymentFields = [
      'cardNumber',
      'cvv',
      'accountNumber',
      'iban',
      'swiftCode',
    ];

    return this.encryptObject(data, paymentFields);
  }

  /**
   * Decrypt payment information
   */
  decryptPayment(data) {
    const paymentFields = [
      'cardNumber',
      'cvv',
      'accountNumber',
      'iban',
      'swiftCode',
    ];

    return this.decryptObject(data, paymentFields);
  }

  /**
   * Mask sensitive data (for logging/display)
   * @param {string} value - Value to mask
   * @param {number} visibleChars - Number of chars to keep visible at end
   * @returns {string} - Masked value (e.g., ****5678)
   */
  mask(value, visibleChars = 4) {
    if (!value) {
      return '';
    }

    const str = String(value);
    if (str.length <= visibleChars) {
      return '*'.repeat(str.length);
    }

    const masked = '*'.repeat(str.length - visibleChars);
    const visible = str.slice(-visibleChars);
    return masked + visible;
  }

  /**
   * Mask credit card number
   */
  maskCreditCard(cardNumber) {
    return this.mask(cardNumber, 4);
  }

  /**
   * Mask SSN
   */
  maskSSN(ssn) {
    return this.mask(ssn, 4);
  }

  /**
   * Mask email (keep domain visible)
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) {
      return email;
    }

    const [username, domain] = email.split('@');
    const visibleChars = Math.min(2, username.length);
    const masked = username.slice(0, visibleChars) + '*'.repeat(Math.max(0, username.length - visibleChars));
    return `${masked}@${domain}`;
  }

  /**
   * Generate a secure random token
   * @param {number} bytes - Number of random bytes
   * @returns {string} - Hex-encoded token
   */
  generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length
   * @returns {string} - Random password
   */
  generateSecurePassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    // Ensure it has at least one of each required character type
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*]/.test(password);

    if (hasUpper && hasLower && hasNumber && hasSpecial) {
      return password;
    }

    // Regenerate if it doesn't meet requirements
    return this.generateSecurePassword(length);
  }

  /**
   * Encrypt data for storage (with compression for large data)
   * @param {any} data - Data to encrypt
   * @returns {string} - Encrypted data
   */
  encryptForStorage(data) {
    const jsonString = JSON.stringify(data);

    // For large data, consider compression
    if (jsonString.length > 1000) {
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(jsonString);
      const encrypted = this.encrypt(compressed.toString('base64'));
      return `compressed:${encrypted}`;
    }

    return this.encrypt(jsonString);
  }

  /**
   * Decrypt data from storage (handles compression)
   * @param {string} encryptedData - Encrypted data
   * @returns {any} - Original data
   */
  decryptFromStorage(encryptedData) {
    if (!encryptedData) {
      return null;
    }

    // Check if data was compressed
    if (encryptedData.startsWith('compressed:')) {
      const encrypted = encryptedData.substring(11);
      const decrypted = this.decrypt(encrypted);

      const zlib = require('zlib');
      const decompressed = zlib.inflateSync(Buffer.from(decrypted, 'base64'));
      return JSON.parse(decompressed.toString());
    }

    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }

  /**
   * Verify encryption key is properly configured
   * @returns {boolean}
   */
  verifyKey() {
    try {
      const testData = 'test-encryption-verification';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      return decrypted === testData;
    } catch (error) {
      logger.error('Encryption key verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const encryptionService = new EncryptionService();

// Verify encryption works on startup
if (!encryptionService.verifyKey()) {
  logger.error('⚠️  Encryption verification failed! Check ENCRYPTION_KEY configuration.');
} else {
  logger.info('✅ Encryption service verified successfully');
}

export default encryptionService;
