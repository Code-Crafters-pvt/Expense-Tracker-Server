import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { passwordChangeLimiter } from '../middleware/rateLimiter';
import { sendPasswordChangedNotification } from '../services/emailService';
import { RefreshToken } from '../models/RefreshToken';

const router = express.Router();

router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const user = req.user;
    
    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile',
    });
  }
});

const validateUpdateProfile = [
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
];

router.put('/profile', authenticate, validateUpdateProfile, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
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

    const { firstName, lastName } = req.body;
    const user = req.user;

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating profile',
    });
  }
});

router.use(authenticate);

// Validation middleware for change password
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      const validation = validatePasswordComplexity(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join('. '));
      }
      
      return true;
    }),
];


// POST /api/users/change-password - Change user password
router.post(
  '/change-password',
  passwordChangeLimiter,
  validateChangePassword,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }
      
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password (password is excluded by default)
      const user = await User.findById(req.user._id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
        });
      }

      // Check if new password is same as old password
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          error: 'New password must be different from current password',
        });
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      
      // Increment token version to invalidate all access tokens
      user.tokenVersion += 1;
      await user.save();

      // Invalidate all refresh tokens (logout from all devices)
      await RefreshToken.updateMany(
        { userId: user._id, isRevoked: false },
        { isRevoked: true }
      );

      try {
        await sendPasswordChangedNotification(user.email!, user.name ?? "");
      } catch (emailError) {
        console.error('Failed to send password changed notification:', emailError);
      }

      res.json({
        success: true,
        message: 'Password changed successfully. You have been logged out from all devices for security.',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error while changing password',
      });
    }
  }
);

// PUT /api/users/profile - Update user profile (name, email)
router.put(
  '/profile',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email'),
  ],
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
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

      const { name, email } = req.body;
      const updateData: any = {};

      if (name) updateData.name = name;
      
      if (email && email !== req.user.email) {
        // Check if email is already taken
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: 'Email is already in use',
          });
        }
        updateData.email = email;
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error while updating profile',
      });
    }
  }
);

// GET /api/users/sessions - View active sessions
router.get('/sessions', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    const user = req.user;
    
    // Get all active refresh tokens for this user
    const sessions = await RefreshToken.find({
      userId: user._id,
      isRevoked: false,
    })
      .select('deviceInfo ipAddress userAgent createdAt expiresAt')
      .sort({ createdAt: -1 })
      .lean();

    // Format sessions for response
    const formattedSessions = sessions.map((session: any) => ({
      id: session._id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));

    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        count: formattedSessions.length,
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching sessions',
    });
  }
});

// DELETE /api/users/sessions/:id - Revoke specific session
router.delete('/sessions/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    const user = req.user;
    const sessionId = req.params.id;

    // Find and revoke the specific session
    const session = await RefreshToken.findOne({
      _id: sessionId,
      userId: user._id,
      isRevoked: false,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already revoked',
      });
    }

    session.isRevoked = true;
    await session.save();

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while revoking session',
    });
  }
});

// DELETE /api/users/account - Deactivate account (soft delete)
router.delete('/account', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }
    
    const user = req.user;

    // Deactivate account
    user.isActive = false;
    
    // Increment token version to invalidate all tokens
    user.tokenVersion += 1;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deactivating account',
    });
  }
});

export default router;