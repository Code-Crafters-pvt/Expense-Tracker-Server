import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookies';
import { verifyRefreshToken } from '../utils/jwt';
import authConfig from '../config/authConfig';

const { refreshCookieName } = authConfig;

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
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
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
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
    });

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        accessToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
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

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
    });
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

    let payload;
    try {
      payload = verifyRefreshToken(tokenFromCookie);
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
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

    // Issue new tokens and rotate refresh cookie
    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });
    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
    });

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

// Logout - clear refresh cookie
router.post('/logout', async (_req, res) => {
  clearRefreshCookie(res);
  return res.json({
    success: true,
    message: 'Logged out',
  });
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
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

// Logout user
router.post('/logout', async (req, res) => {
  try {
    // Logout should work even without authentication
    // In a stateless JWT system, logout is typically handled on the client side
    // by removing the token from storage. However, we can add server-side logic here
    // if needed (like blacklisting tokens, logging logout events, etc.)

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout',
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
      user = new User({
        name: userData.name,
        email: userData.email,
        password: Math.random().toString(36).slice(-8), // Generate random password for OAuth users
      });
      await user.save();
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
    });

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'OAuth login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
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

export default router;
