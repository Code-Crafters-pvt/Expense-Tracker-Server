import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookies';
import { verifyRefreshToken } from '../utils/jwt';
import { isTokenVersionValid } from '../utils/authChecks';
import authConfig from '../config/authConfig';
import { ResetToken } from '../models/ResetToken';
import { RefreshToken } from '../models/RefreshToken';
import { sendPasswordResetEmail } from '../services/emailService';
import { passwordResetLimiter, loginLimiter, loginFailureLimiter } from '../middleware/rateLimiter';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { getClientIpAddress, getDeviceInfo, parseFullName } from '../utils/requestHelpers';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';


const { refreshCookieName, refreshTokenTtl } = authConfig;

// Time conversion constants
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// Helper to calculate token expiration date
const getTokenExpirationDate = (ttl: string): Date => {
  const value = parseInt(ttl);
  const unit = ttl.slice(-1);
  const now = Date.now();
  
  let milliseconds = 0;
  switch (unit) {
    case 's': milliseconds = value * MS_PER_SECOND; break;
    case 'm': milliseconds = value * MS_PER_MINUTE; break;
    case 'h': milliseconds = value * MS_PER_HOUR; break;
    case 'd': milliseconds = value * MS_PER_DAY; break;
    default: milliseconds = value * MS_PER_HOUR; // default to hours
  }
  
  return new Date(now + milliseconds);
};

const router = express.Router();

// Initialize OAuth clients
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Validation middleware
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .custom((value) => {
      // Use passwordValidator for all checks
      const validation = validatePasswordComplexity(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('. '));
      }
      return true;
    }),
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validateOfflineUser = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('First name must be between 1 and 25 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('Last name must be between 1 and 25 characters'),
];

const validateSyncOfflineUser = [
  body('offlineId')
    .notEmpty()
    .withMessage('Offline ID is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .custom((value) => {
      const validation = validatePasswordComplexity(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('. '));
      }
      return true;
    }),
];

// Create offline user
router.post('/create-offline-user', loginLimiter, validateOfflineUser, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { firstName, lastName } = req.body;

    // Generate unique offline ID
    const offlineId = `offline_${uuidv4()}`;
    const offlineIdHash = crypto.createHash('sha256').update(offlineId).digest('hex');

    // Create offline user
    const user = new User({
      firstName,
      lastName,
      isOfflineUser: true,
      offlineId: offlineIdHash,
      syncStatus: 'offline',
      role: 'user',
      isActive: true,
      isEmailVerified: false, // Will be true when they sync
      tokenVersion: 0,
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Offline user created successfully',
      data: {
        offlineId,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          isOfflineUser: user.isOfflineUser,
          syncStatus: user.syncStatus,
        },
      },
    });
  } catch (error: any) {
    console.error('Create offline user error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }
    
    // Other server errors
    res.status(500).json({
      success: false,
      error: 'Server error during offline user creation',
    });
  }
});

// Sync offline user to online user
router.post('/sync-offline-user', loginLimiter, validateSyncOfflineUser, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { offlineId, email, password } = req.body;
    const offlineIdHash = crypto.createHash('sha256').update(offlineId).digest('hex');

    // Find offline user
    const offlineUser = await User.findOne({ 
      offlineId: offlineIdHash,
      isOfflineUser: true,
      syncStatus: 'offline'
    });

    if (!offlineUser) {
      return res.status(404).json({
        success: false,
        error: 'Offline user not found or already synced',
      });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email,
      _id: { $ne: offlineUser._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email is already registered',
      });
    }

    // Update offline user to online user
    offlineUser.email = email;
    offlineUser.password = password;
    offlineUser.isOfflineUser = false;
    offlineUser.syncStatus = 'synced';
    offlineUser.isEmailVerified = true; // Assume verified when they sync
    offlineUser.lastLoginAt = new Date();

    await offlineUser.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: offlineUser._id.toString(),
      email: offlineUser.email!,
      tokenVersion: offlineUser.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: offlineUser._id.toString(),
      email: offlineUser.email!,
      tokenVersion: offlineUser.tokenVersion,
    });

    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getClientIpAddress(req);
    
    await RefreshToken.createRefreshToken(
      offlineUser._id,
      refreshToken,
      getTokenExpirationDate(refreshTokenTtl),
      deviceInfo,
      ipAddress,
      req.headers['user-agent']
    );

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Offline user synced successfully',
      data: {
        user: {
          id: offlineUser._id,
          firstName: offlineUser.firstName,
          lastName: offlineUser.lastName,
          name: offlineUser.name,
          email: offlineUser.email,
          isOfflineUser: offlineUser.isOfflineUser,
          syncStatus: offlineUser.syncStatus,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('Sync offline user error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }
    
    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email is already registered',
      });
    }
    
    // Other server errors
    res.status(500).json({
      success: false,
      error: 'Server error during sync',
    });
  }
});

// Register user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists FIRST (before expensive validation)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Then check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    // Parse name into firstName and lastName
    const { firstName, lastName } = parseFullName(name);

    // Create new user
    const user = new User({
      firstName,
      lastName,
      name, // Keep for backward compatibility
      email,
      password,
      isOfflineUser: false,
      syncStatus: 'synced',
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getClientIpAddress(req);
    
    await RefreshToken.createRefreshToken(
      user._id,
      refreshToken,
      getTokenExpirationDate(refreshTokenTtl),
      deviceInfo,
      ipAddress,
      req.headers['user-agent']
    );

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }
    
    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }
    
    // Other server errors
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
});

// Login user
router.post('/login', loginFailureLimiter, loginLimiter, validateLogin, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact support.',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getClientIpAddress(req);
    
    await RefreshToken.createRefreshToken(
      user._id,
      refreshToken,
      getTokenExpirationDate(refreshTokenTtl),
      deviceInfo,
      ipAddress,
      req.headers['user-agent']
    );

    setRefreshCookie(res, refreshToken);
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login',
    });
  }
});

// Refresh token (httpOnly cookie-based)
router.post('/refresh', async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.[refreshCookieName];
    if (!tokenFromCookie) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token',
      });
    }

    // Verify JWT signature first
    let payload;
    try {
      payload = verifyRefreshToken(tokenFromCookie);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Hash token and check if it exists in database
    const hashedToken = RefreshToken.hashToken(tokenFromCookie);
    const storedToken = await RefreshToken.findOne({
      token: hashedToken,
      isRevoked: false,
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or revoked refresh token',
      });
    }

    // Find user
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated',
      });
    }

    // Check token version (required and must match)
    if (!isTokenVersionValid(payload, user)) {
      // Token version mismatch - invalidate this token
      await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });
      return res.status(401).json({
        success: false,
        error: 'Token has been invalidated. Please log in again.',
      });
    }

    // Revoke old refresh token (token rotation)
    await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });

    // Issue new tokens
    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });
    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    // Store new refresh token in database
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getClientIpAddress(req);
    
    await RefreshToken.createRefreshToken(
      user._id,
      newRefreshToken,
      getTokenExpirationDate(refreshTokenTtl),
      deviceInfo,
      ipAddress,
      req.headers['user-agent']
    );

    setRefreshCookie(res, newRefreshToken);

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

// Logout - invalidate refresh token and clear cookie
router.post('/logout', async (req, res) => {
  try {
    const tokenFromCookie = req.cookies?.[refreshCookieName];
    
    if (tokenFromCookie) {
      // Hash the token to find it in database
      const hashedToken = RefreshToken.hashToken(tokenFromCookie);
      
      // Mark token as revoked (soft delete)
      await RefreshToken.findOneAndUpdate(
        { token: hashedToken },
        { isRevoked: true }
      );
    }
    
    clearRefreshCookie(res);
    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie even if DB operation fails
    clearRefreshCookie(res);
    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

// Logout from all devices - invalidate all refresh tokens for user
router.post('/logout-all', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    const user = req.user;
    
    // Increment token version to invalidate all access tokens
    user.tokenVersion += 1;
    await user.save();
    
    // Revoke all refresh tokens for this user
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );
    
    // Clear current cookie
    clearRefreshCookie(res);
    
    return res.json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  } catch (error) {
    console.error('Logout all error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during logout',
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// OAuth login
router.post('/oauth', async (req, res) => {
  try {
    const { provider, token, name, email } = req.body;

    let userData: { name: string; email: string } | null = null;

    // Verify token and get user info based on provider
    switch (provider) {
      case 'google':
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (!payload) throw new Error('Invalid Google token');

          userData = {
            name: payload.name || '',
            email: payload.email || '',
          };
        } catch (error) {
          throw new Error('Failed to verify Google token');
        }
        break;

      case 'facebook':
        try {
          const response = await axios.get(
            `https://graph.facebook.com/me?fields=name,email&access_token=${token}`
          );
          userData = {
            name: response.data.name,
            email: response.data.email,
          };
        } catch (error) {
          throw new Error('Failed to verify Facebook token');
        }
        break;

      case 'apple':
        // For Apple Sign In, we trust the token verification done on the client side
        // since Apple's JWT contains the user info and is already verified
        userData = {
          name: name || '',
          email: email || '',
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid OAuth provider',
        });
    }

    if (!userData || !userData.email) {
      return res.status(400).json({
        success: false,
        error: 'Could not get user email from OAuth provider',
      });
    }

    // Find or create user
    let user = await User.findOne({ email: userData.email });

    if (!user) {
      // Parse name into firstName and lastName
      const { firstName, lastName } = parseFullName(userData.name);

      user = new User({
        firstName,
        lastName,
        name: userData.name, // Keep for backward compatibility
        email: userData.email,
        password: Math.random().toString(36).slice(-8), // Generate random password for OAuth users
        isOfflineUser: false,
        syncStatus: 'synced',
      });
      await user.save();
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact support.',
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email!,
      tokenVersion: user.tokenVersion,
    });

    // Store refresh token in database
    const deviceInfo = getDeviceInfo(req);
    const ipAddress = getClientIpAddress(req);
    
    await RefreshToken.createRefreshToken(
      user._id,
      refreshToken,
      getTokenExpirationDate(refreshTokenTtl),
      deviceInfo,
      ipAddress,
      req.headers['user-agent']
    );

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'OAuth login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email!,
        },
        accessToken,
      },
    });
  } catch (error) {
    console.error('OAuth login error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'OAuth login failed',
    });
  }
});

// Forgot password - Request reset token
router.post(
  '/forgot-password',
  passwordResetLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ email });

      // Always return success (security: don't reveal if email exists)
      if (!user) {
        return res.json({
          success: true,
          message: 'If that email exists, a reset link has been sent',
        });
      }

      // Invalidate any existing reset tokens for this user
      await ResetToken.updateMany(
        { userId: user._id, used: false },
        { used: true }
      );

      // Generate reset token (cryptographically secure)
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash token before storing (security best practice)
      const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Create reset token record (expires in 1 hour)
      await ResetToken.create({
        userId: user._id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        used: false,
      });

      // Send reset email
      try {
        await sendPasswordResetEmail(user.email!, resetToken);
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during password reset request',
      });
    }
  }
);

// Reset password - Use token to set new password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .custom((value) => {
        const validation = validatePasswordComplexity(value);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('. '));
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { token, newPassword } = req.body;

      // Hash the provided token to match stored hash
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find valid reset token
      const resetToken = await ResetToken.findOne({
        token: hashedToken,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!resetToken) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token',
        });
      }

      // Find user with password
      const user = await User.findById(resetToken.userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      // Mark token as used
      resetToken.used = true;
      await resetToken.save();

      // Invalidate all other reset tokens for this user
      await ResetToken.updateMany(
        { userId: user._id, _id: { $ne: resetToken._id }, used: false },
        { used: true }
      );

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during password reset',
      });
    }
  }
);

export default router;
