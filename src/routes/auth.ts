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
import { sendPasswordResetEmail } from '../services/emailService';
import { passwordResetLimiter, loginLimiter, loginFailureLimiter } from '../middleware/rateLimiter';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { getClientIpAddress, getDeviceInfo, parseFullName } from '../utils/requestHelpers';
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

// Register user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    // 'name' is accepted for backward compatibility; we derive firstName/lastName as primary fields
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { firstName, lastName } = parseFullName(name);

    const user = new User({
      firstName,
      lastName,
      name,
      email,
      password,
    });

    await user.save();

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

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        serverUserId: user._id.toString(),
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
        refreshToken,
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

    // Verify JWT signature first
    let payload;
    try {
      payload = verifyRefreshToken(incomingRefreshToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Hash token and check if it exists in database
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
    
    // Revoke all refresh tokens for this user
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
        name: userData.name,
        email: userData.email,
        // Generate secure random placeholder password for OAuth users
        password: crypto
          .randomBytes(6)
          .toString('base64')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 8),
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

    res.json({
      success: true,
      message: 'OAuth login successful',
      data: {
        serverUserId: user._id.toString(),
        user: {
          id: user._id,
          name: user.name,
          email: user.email!,
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
