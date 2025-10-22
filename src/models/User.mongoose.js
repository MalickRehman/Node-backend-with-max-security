import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import config from '../config/environment.js';

/**
 * User Schema for MongoDB
 */

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must not exceed 30 characters'],
      index: true,
    },
    password: {
      type: String,
      required: function () {
        // Password not required for OAuth users
        return !this.authProvider || this.authProvider === 'local';
      },
      minlength: 8,
      select: false, // Don't include password in queries by default
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local',
    },
    oauth: {
      google: {
        id: { type: String, sparse: true },
        email: String,
        displayName: String,
      },
      github: {
        id: { type: String, sparse: true },
        username: String,
        profileUrl: String,
      },
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin', 'guest'],
      default: 'user',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorBackupCodes: {
      type: [String],
      select: false,
      default: [],
    },
    passwordHistory: {
      type: [String],
      select: false,
      default: [],
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    lastLogin: {
      type: Date,
    },
    lastPasswordChange: {
      type: Date,
    },
    requirePasswordChange: {
      type: Boolean,
      default: false,
    },
    refreshTokens: {
      type: [
        {
          token: String,
          createdAt: Date,
          expiresAt: Date,
          isRevoked: Boolean,
        },
      ],
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.passwordHistory;
        delete ret.twoFactorSecret;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ username: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'oauth.google.id': 1 }, { sparse: true });
userSchema.index({ 'oauth.github.id': 1 }, { sparse: true });

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password
    const salt = await bcrypt.genSalt(config.bcrypt.rounds);
    this.password = await bcrypt.hash(this.password, salt);

    // Add to password history
    if (!this.passwordHistory) {
      this.passwordHistory = [];
    }
    this.passwordHistory.push(this.password);

    // Keep only last 5 passwords
    if (this.passwordHistory.length > 5) {
      this.passwordHistory = this.passwordHistory.slice(-5);
    }

    this.lastPasswordChange = new Date();

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance Methods
 */

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  // Lock account after 5 failed attempts for 15 minutes
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    this.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
  }
  this.loginAttempts += 1;
  return await this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.lastLogin = new Date();
  return await this.save();
};

// Check if password was used before
userSchema.methods.isPasswordInHistory = async function (password) {
  if (!this.passwordHistory || this.passwordHistory.length === 0) {
    return false;
  }

  for (const oldHash of this.passwordHistory) {
    const isMatch = await bcrypt.compare(password, oldHash);
    if (isMatch) {
      return true;
    }
  }
  return false;
};

/**
 * Static Methods
 */

// Validate password strength
userSchema.statics.validatePasswordStrength = function (password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Find by email
userSchema.statics.findByEmail = function (email) {
  console.log('Finding user by email:', email);
  return this.findOne({ email: email?.toLowerCase() }).select('+password +passwordHistory');
};

// Find by username
userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.toLowerCase() }).select('+password');
};

// Create user with validation
userSchema.statics.createUser = async function (userData) {
  // Validate password strength
  const validation = this.validatePasswordStrength(userData.password);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  const user = new this(userData);
  await user.save();
  return user;
};

/**
 * Virtual fields
 */
userSchema.virtual('fullName').get(function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

const User = mongoose.model('User', userSchema);

export default User;
