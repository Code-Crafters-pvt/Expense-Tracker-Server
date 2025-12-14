import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { verifyRefreshToken } from '../utils/jwt';
import { isTokenVersionValid } from '../utils/authChecks';
import authConfig from '../config/authConfig';
import { ResetToken } from '../models/ResetToken';
import { RefreshToken } from '../models/RefreshToken';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../services/email';
import { AccountStatus } from '../enums/AccountStatus';
import { passwordResetLimiter, loginLimiter, loginFailureLimiter } from '../middleware/rateLimiter';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { getClientIpAddress, getDeviceInfo, parseFullName, getValidUserName, extractNameFromEmail } from '../utils/requestHelpers';
import crypto from 'crypto';


const { refreshTokenTtl } = authConfig;

// Time conversion constants
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// Helper to calculate token expiration date
const getTokenExpirationDate = (ttl: string): Date => {
  // Validate TTL format: positive integer followed by unit (s, m, h, d)
  const ttlPattern = /^(\d+)([smhd])$/;
  const match = ttl?.match(ttlPattern);
  const now = Date.now();

  if (!match) {
    // Fallback to 1 hour if TTL is invalid or missing
    return new Date(now + MS_PER_HOUR);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (!Number.isFinite(value) || value <= 0) {
    return new Date(now + MS_PER_HOUR);
  }

  let milliseconds = 0;
  switch (unit) {
    case 's': milliseconds = value * MS_PER_SECOND; break;
    case 'm': milliseconds = value * MS_PER_MINUTE; break;
    case 'h': milliseconds = value * MS_PER_HOUR; break;
    case 'd': milliseconds = value * MS_PER_DAY; break;
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
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('First name must be between 1 and 25 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('Last name must be between 1 and 25 characters'),
  body('name')
    .optional()
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
  // Custom validation: require either firstName+lastName OR name
  body().custom((value) => {
    const hasFirstNameLastName = value.firstName && value.lastName;
    const hasName = value.name;
    
    if (!hasFirstNameLastName && !hasName) {
      throw new Error('Either firstName and lastName, or name must be provided');
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

// Register user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { firstName, lastName, name, email, password } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.accountStatus === AccountStatus.PENDING_VERIFICATION) {
        let nameUpdated = false;
        if (firstName && firstName.trim() !== existingUser.firstName) {
          existingUser.firstName = firstName.trim();
          nameUpdated = true;
        }
        if (lastName && lastName.trim() !== existingUser.lastName) {
          existingUser.lastName = lastName.trim();
          nameUpdated = true;
        }
        if (name && name.trim() !== existingUser.name) {
          existingUser.name = name.trim();
          nameUpdated = true;
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
          .createHash('sha256')
          .update(verificationToken)
          .digest('hex');

        existingUser.emailVerificationToken = hashedToken;
        existingUser.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        if (nameUpdated) {
          await existingUser.save();
        } else {
          await User.updateOne(
            { _id: existingUser._id },
            {
              emailVerificationToken: hashedToken,
              emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          );
        }

        const verificationUrl = `${process.env.APP_URL || 'http://localhost:19006'}/verify-email?token=${verificationToken}`;
        const displayName = existingUser.name || 
          (existingUser.firstName && existingUser.lastName 
            ? `${existingUser.firstName} ${existingUser.lastName}` 
            : existingUser.firstName || existingUser.lastName || 'User');

        if (!existingUser.email) {
          return res.status(400).json({
            success: false,
            error: 'User email is missing. Please contact support.',
          });
        }

        try {
          await sendVerificationEmail(
            existingUser.email,
            displayName,
            verificationUrl
          );

          return res.status(200).json({
            success: true,
            message: 'A verification email has been resent. Please check your inbox to verify your account.',
            data: {
              email: existingUser.email,
              requiresVerification: true,
              note: 'If you forgot your password, please verify your email first, then use the "Forgot Password" option.',
            },
          });
        } catch (emailError) {
          console.error('Failed to resend verification email:', emailError);

          return res.status(200).json({
            success: true,
            message: 'Account exists but verification email could not be sent. Please try again or contact support.',
            data: {
              email: existingUser.email,
              requiresVerification: true,
              emailFailed: true,
            },
          });
        }
      }

      if (existingUser.accountStatus === AccountStatus.DELETED) {
        return res.status(400).json({
          success: false,
          error: 'This account is scheduled for deletion. Please contact support to restore it, or use the "Cancel Deletion" option if within the 30-day grace period.',
        });
      }

      if (existingUser.accountStatus === AccountStatus.DEACTIVATED) {
        return res.status(400).json({
          success: false,
          error: 'This account is deactivated. Please use "Reactivate Account" option.',
        });
      }

      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    let finalFirstName: string;
    let finalLastName: string;
    
    if (firstName && lastName) {
      finalFirstName = firstName.trim();
      finalLastName = lastName.trim();
    } else {
      const parsed = parseFullName(name!);
      finalFirstName = parsed.firstName;
      finalLastName = parsed.lastName;
      
      if (!finalFirstName || !finalLastName) {
        const emailBased = extractNameFromEmail(email);
        finalFirstName = finalFirstName || emailBased.firstName;
        finalLastName = finalLastName || emailBased.lastName;
        
        if (!finalFirstName) {
          const emailPrefix = email.split('@')[0] || 'User';
          finalFirstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).toLowerCase();
        }
        if (!finalLastName) {
          finalLastName = finalFirstName; // Use firstName as lastName
        }
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const user = new User({
      firstName: finalFirstName,
      lastName: finalLastName,
      name: name || `${finalFirstName} ${finalLastName}`.trim(),
      email,
      password,
      accountStatus: AccountStatus.PENDING_VERIFICATION,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await user.save();

    const verificationUrl = `${process.env.APP_URL || 'http://localhost:19006'}/verify-email?token=${verificationToken}`;
    let emailSent = false;

    if (user.email) {
      try {
        const displayName = user.name || `${finalFirstName} ${finalLastName}`.trim() || 'User';
        await sendVerificationEmail(user.email, displayName, verificationUrl);
        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }
    } else {
      console.error('User email is missing, cannot send verification email.');
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful! Verification email could not be sent. Please use "Resend Verification" option.',
      data: {
        email: user.email,
        name: user.name,
        requiresVerification: true,
        emailSent,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

// Login user
router.post('/login', loginFailureLimiter, loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    if (user.accountStatus === AccountStatus.PENDING_VERIFICATION) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox or use "Resend Verification".',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      return res.status(403).json({
        success: false,
        error: 'Your account is deactivated. Please reactivate it to continue.',
        code: 'ACCOUNT_DEACTIVATED',
        email: user.email,
      });
    }

    if (user.accountStatus === AccountStatus.DELETED) {
      return res.status(403).json({
        success: false,
        error: 'Your account is scheduled for deletion. Please contact support to restore it.',
        code: 'ACCOUNT_DELETED',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Validate email exists before generating tokens
    if (!user.email) {
      console.error('User email is missing during login');
      return res.status(500).json({
        success: false,
        error: 'User record is missing an email address. Please contact support.',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

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

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        serverUserId: user._id.toString(),
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
        refreshToken,
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

// Refresh token (expects token in request body)
router.post('/refresh', async (req, res) => {
  try {
    const incomingRefreshToken = req.body?.refreshToken as string | undefined;

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token',
      });
    }

    let payload;
    try {
      payload = verifyRefreshToken(incomingRefreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    const hashedToken = RefreshToken.hashToken(incomingRefreshToken);
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

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated',
      });
    }

    if (!isTokenVersionValid(payload, user)) {
      await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });
      return res.status(401).json({
        success: false,
        error: 'Token has been invalidated. Please log in again.',
      });
    }

    await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });

    // Validate email exists before generating tokens
    if (!user.email) {
      console.error('User email is missing during token refresh');
      return res.status(500).json({
        success: false,
        error: 'User record is missing an email address. Please contact support.',
      });
    }

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });
    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

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

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
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

// Logout - invalidate refresh token
router.post('/logout', async (req, res) => {
  try {
    const tokenFromBody = req.body?.refreshToken as string | undefined;

    if (tokenFromBody) {
      const hashedToken = RefreshToken.hashToken(tokenFromBody);

      await RefreshToken.findOneAndUpdate(
        { token: hashedToken },
        { isRevoked: true }
      );
    }

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
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
    
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );
    
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

    let user = await User.findOne({ email: userData.email });

    if (!user) {
      const { firstName, lastName, fullName } = getValidUserName(userData.name, userData.email);

      user = new User({
        firstName,
        lastName,
        name: userData.name || fullName,
        email: userData.email,
        password: crypto
          .randomBytes(6)
          .toString('base64')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 8),
        accountStatus: AccountStatus.ACTIVE,
      });
      await user.save();
    }

    // Check account status
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      return res.status(403).json({
        success: false,
        error: 'Your account is deactivated. Please reactivate it to continue.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    if (user.accountStatus === AccountStatus.DELETED) {
      return res.status(403).json({
        success: false,
        error: 'Your account is scheduled for deletion. Please contact support to restore it.',
        code: 'ACCOUNT_DELETED',
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Validate email exists before generating tokens
    if (!user.email) {
      console.error('User email is missing during OAuth login');
      return res.status(500).json({
        success: false,
        error: 'User record is missing an email address. Please contact support.',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

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

    res.json({
      success: true,
      message: 'OAuth login successful',
      data: {
        serverUserId: user._id.toString(),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
        accessToken,
        refreshToken,
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
      if (!user.email) {
        console.error('User email is missing, cannot send reset email');
        return res.json({
          success: true,
          message: 'If that email exists, a reset link has been sent',
        });
      }

      try {
        await sendPasswordResetEmail(user.email, resetToken);
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

// Verify email address
router.post(
  '/verify-email',
  [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required'),
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

      const { token } = req.body;

      // Hash the provided token to match stored hash
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find user with matching token and non-expired date
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() },
      }).select('+emailVerificationToken');

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token',
        });
      }

      // Check if already verified
      if (user.accountStatus === AccountStatus.ACTIVE) {
        return res.status(400).json({
          success: false,
          error: 'Email is already verified',
        });
      }

      // Update account status
      user.accountStatus = AccountStatus.ACTIVE;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      // Send welcome email
      if (!user.email) {
        console.error('User email is missing, cannot send welcome email');
      } else {
        try {
          await sendWelcomeEmail(user.email, user.name || `${user.firstName} ${user.lastName}`);
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail verification if email fails
        }
      }

      res.json({
        success: true,
        message: 'Email verified successfully! You can now log in.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            isEmailVerified: true,
          },
        },
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during email verification',
      });
    }
  }
);

// Resend verification email
router.post(
  '/resend-verification',
  passwordResetLimiter, // Reuse rate limiter for security
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
      const user = await User.findOne({ email }).select('+emailVerificationToken');

      // Always return success (security: don't reveal if email exists)
      if (!user) {
        return res.json({
          success: true,
          message: 'If that email exists and is not verified, a verification link has been sent',
        });
      }

      // Check if already verified
      if (user.accountStatus === AccountStatus.ACTIVE) {
        return res.status(400).json({
          success: false,
          error: 'Email is already verified',
        });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      // Update user with new token
      user.emailVerificationToken = hashedVerificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();

      // Send verification email
      if (!user.email) {
        console.error('User email is missing, cannot send verification email');
      } else {
        try {
          const verificationUrl = `${process.env.APP_URL || 'http://localhost:19006'}/verify-email?token=${verificationToken}`;
          await sendVerificationEmail(user.email, user.name || `${user.firstName} ${user.lastName}`, verificationUrl);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({
        success: true,
        message: 'If that email exists and is not verified, a verification link has been sent',
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during resend verification',
      });
    }
  }
);

export default router;
