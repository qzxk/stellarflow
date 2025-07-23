/**
 * User Model
 * MongoDB schema for user authentication and profile management
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false, // Don't include password in queries by default
  },
  
  // Profile Information
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    dateOfBirth: {
      type: Date,
    },
    phoneNumber: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please provide a valid phone number'],
    },
  },
  
  // Authentication & Security
  emailVerified: {
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
  
  passwordResetToken: {
    type: String,
    select: false,
  },
  
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  
  passwordChangedAt: {
    type: Date,
    select: false,
  },
  
  // Account Security
  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  
  lockUntil: {
    type: Date,
    select: false,
  },
  
  twoFactorAuth: {
    enabled: {
      type: Boolean,
      default: false,
    },
    secret: {
      type: String,
      select: false,
    },
    backupCodes: [{
      type: String,
      select: false,
    }],
  },
  
  // User Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending',
  },
  
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  
  // Activity Tracking
  lastLogin: {
    type: Date,
  },
  
  lastActive: {
    type: Date,
    default: Date.now,
  },
  
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    location: {
      country: String,
      city: String,
    },
  }],
  
  // Refresh Tokens
  refreshTokens: [{
    token: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
    },
  }],
  
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.twoFactorAuth.secret;
      delete ret.twoFactorAuth.backupCodes;
      return ret;
    },
  },
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'refreshTokens.token': 1 });
userSchema.index({ 'refreshTokens.expiresAt': 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('profile.fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile.firstName || this.profile.lastName || '';
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with salt rounds from config
    const saltRounds = config.security.bcryptSaltRounds;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set passwordChangedAt
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  
  this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure token is always created after password change
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not available for comparison');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    userId: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: config.jwt.algorithm,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
};

// Instance method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    userId: this._id,
    type: 'refresh',
  };
  
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    algorithm: config.jwt.algorithm,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
};

// Instance method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  
  return false;
};

// Instance method to handle login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we have reached max attempts and it's not locked already, lock the account
  if (this.loginAttempts + 1 >= config.security.maxLoginAttempts && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + config.security.lockoutTime,
    };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1,
    },
  });
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function(identifier, password) {
  // Find user by email or username
  const user = await this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() },
    ],
  }).select('+password +loginAttempts +lockUntil');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if account is locked
  if (user.isLocked) {
    await user.incLoginAttempts();
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }
  
  // Check password
  const isPasswordMatch = await user.comparePassword(password);
  
  if (!isPasswordMatch) {
    await user.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }
  
  // Update last login
  user.lastLogin = new Date();
  await user.save();
  
  return user;
};

// Static method to clean expired refresh tokens
userSchema.statics.cleanExpiredTokens = async function() {
  return this.updateMany(
    {},
    {
      $pull: {
        refreshTokens: {
          expiresAt: { $lt: new Date() },
        },
      },
    }
  );
};

const User = mongoose.model('User', userSchema);

module.exports = User;