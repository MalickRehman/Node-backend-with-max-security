import mongoose from 'mongoose';
import { encryptionPlugin } from '../utils/encryptionPlugin.js';

/**
 * User Profile Schema with Encrypted Fields
 * Demonstrates field-level encryption for sensitive PII data
 */

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Personal Information (some fields encrypted)
    phone: {
      type: String,
      trim: true,
    },
    phoneHash: {
      type: String,
      select: false,
      index: true,
    },

    // Address Information
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },

    // Sensitive PII (encrypted)
    ssn: {
      type: String,
      select: false, // Never include in regular queries
    },
    ssnHash: {
      type: String,
      select: false,
      index: true,
    },

    driverLicense: {
      type: String,
      select: false,
    },

    passportNumber: {
      type: String,
      select: false,
    },

    // Date of Birth (searchable but encrypted)
    dateOfBirth: {
      type: String, // Stored as encrypted string
      select: false,
    },
    dateOfBirthHash: {
      type: String,
      select: false,
      index: true,
    },

    // Emergency Contact (encrypted)
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String, // This will be encrypted
    },

    // Banking Information (highly sensitive, encrypted)
    bankAccount: {
      accountNumber: {
        type: String,
        select: false,
      },
      routingNumber: {
        type: String,
        select: false,
      },
      bankName: String,
    },

    // Payment Information (encrypted)
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ['credit_card', 'debit_card', 'bank_account'],
        },
        last4: String, // Last 4 digits (not encrypted, for display)
        cardBrand: String, // Visa, Mastercard, etc.
        expiryMonth: Number,
        expiryYear: Number,
        cardholderName: String,
        // Full card number is encrypted
        cardNumber: {
          type: String,
          select: false,
        },
        // CVV is NEVER stored (PCI compliance)
        // cvv: DO NOT STORE
      },
    ],

    // Medical Information (encrypted, HIPAA compliance)
    medicalInfo: {
      bloodType: String,
      allergies: [String],
      medications: [String],
      conditions: [String],
      insuranceNumber: {
        type: String,
        select: false,
      },
      insuranceProvider: String,
    },

    // Two-Factor Backup Methods (encrypted)
    twoFactorBackup: {
      backupEmail: String, // Encrypted
      backupPhone: String, // Encrypted
      securityQuestions: [
        {
          question: String,
          answerHash: String, // One-way hash, not encrypted
        },
      ],
    },

    // Metadata
    profileCompleteness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },

    verifications: {
      phoneVerified: {
        type: Boolean,
        default: false,
      },
      addressVerified: {
        type: Boolean,
        default: false,
      },
      identityVerified: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        // Never expose these fields in JSON
        delete ret.ssn;
        delete ret.ssnHash;
        delete ret.dateOfBirthHash;
        delete ret.phoneHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Apply encryption plugin with specified fields
userProfileSchema.plugin(encryptionPlugin, {
  // Regular encrypted fields (no searching needed)
  fields: [
    'driverLicense',
    'passportNumber',
    'bankAccount.accountNumber',
    'bankAccount.routingNumber',
    'medicalInfo.insuranceNumber',
    'twoFactorBackup.backupEmail',
    'twoFactorBackup.backupPhone',
    'emergencyContact.phone',
  ],

  // Searchable encrypted fields (creates hash for searching)
  searchableFields: ['phone', 'ssn', 'dateOfBirth'],
});

// Indexes for performance
userProfileSchema.index({ userId: 1 });
userProfileSchema.index({ phoneHash: 1 });
userProfileSchema.index({ ssnHash: 1 });
userProfileSchema.index({ 'verifications.identityVerified': 1 });

/**
 * Instance Methods
 */

// Get masked sensitive fields for display
userProfileSchema.methods.getMaskedProfile = function () {
  const profile = this.toObject();

  // Mask SSN
  if (this.ssn) {
    profile.ssn = encryptionService.mask(this.ssn, 4);
  }

  // Mask phone
  if (this.phone) {
    profile.phone = encryptionService.mask(this.phone, 4);
  }

  // Mask bank account
  if (this.bankAccount?.accountNumber) {
    profile.bankAccount.accountNumber = encryptionService.mask(this.bankAccount.accountNumber, 4);
  }

  // Mask card numbers
  if (this.paymentMethods) {
    profile.paymentMethods = this.paymentMethods.map((pm) => ({
      ...pm.toObject(),
      cardNumber: pm.cardNumber ? encryptionService.mask(pm.cardNumber, 4) : undefined,
    }));
  }

  return profile;
};

// Calculate profile completeness
userProfileSchema.methods.calculateCompleteness = function () {
  const fields = [
    'phone',
    'address.street',
    'address.city',
    'address.state',
    'address.zipCode',
    'dateOfBirth',
    'emergencyContact.name',
    'emergencyContact.phone',
  ];

  let completed = 0;
  fields.forEach((field) => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], this);
    if (value) completed++;
  });

  this.profileCompleteness = Math.round((completed / fields.length) * 100);
  return this.profileCompleteness;
};

/**
 * Static Methods
 */

// Find profile by encrypted SSN
userProfileSchema.statics.findBySSN = async function (ssn) {
  return this.findByEncryptedField('ssn', ssn);
};

// Find profile by encrypted phone
userProfileSchema.statics.findByPhone = async function (phone) {
  return this.findByEncryptedField('phone', phone);
};

// Verify identity
userProfileSchema.statics.verifyIdentity = async function (userId, ssn, dateOfBirth) {
  const profile = await this.findOne({ userId }).select('+ssn +dateOfBirth');

  if (!profile) {
    return false;
  }

  // Decrypt and compare
  const ssnMatch = profile.ssn === ssn;
  const dobMatch = profile.dateOfBirth === dateOfBirth;

  return ssnMatch && dobMatch;
};

/**
 * Pre-save middleware
 */
userProfileSchema.pre('save', function (next) {
  // Calculate profile completeness
  this.calculateCompleteness();

  // Update lastUpdated
  this.lastUpdated = new Date();

  // Extract last 4 digits from card numbers for display
  if (this.paymentMethods) {
    this.paymentMethods.forEach((pm) => {
      if (pm.cardNumber && !pm.last4) {
        // Get last 4 before encryption
        const cardNum = String(pm.cardNumber);
        pm.last4 = cardNum.slice(-4);
      }
    });
  }

  next();
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

export default UserProfile;
