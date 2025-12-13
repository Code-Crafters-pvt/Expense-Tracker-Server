import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { passwordChangeLimiter, accountReactivateLimiter, accountReactivateFailureLimiter } from '../middleware/rateLimiter';
import {
  sendPasswordChangedNotification,
  sendEmailChangedNotification,
  sendAccountDeletionEmail,
  sendAccountReactivationEmail,
  sendAccountDeactivationEmail,
  sendSessionRevokedNotification,
} from '../services/email';
import { RefreshToken } from '../models/RefreshToken';
import { AccountStatus } from '../enums/AccountStatus';

const router = express.Router();

// POST /api/users/account/reactivate - Reactivate account (public endpoint)
router.post('/account/reactivate', accountReactivateFailureLimiter, accountReactivateLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
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

    // Find user
    const user = await User.findOne({ email }).select('+password');

    // Security: Use generic error message to prevent user enumeration
    // Don't reveal whether user exists, account status, or password validity
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    if (user.accountStatus !== AccountStatus.DEACTIVATED) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Reactivate account
    user.accountStatus = AccountStatus.ACTIVE;
    user.deactivatedAt = undefined;
    user.isActive = true;
    await user.save();

    // Send reactivation email
    if (!user.email) {
      console.error('User email is missing, cannot send reactivation email');
    } else {
      try {
        await sendAccountReactivationEmail(
          user.email,
          user.name || `${user.firstName} ${user.lastName}`
        );
      } catch (emailError) {
        console.error('Failed to send reactivation email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'Account reactivated successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate account',
    });
  }
});


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
];

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

// PUT /api/users/profile - Update user profile (firstName, lastName, name, email)
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

    const { firstName, lastName, name, email } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const oldEmail = user.email;
    const updateData: any = {};

    // Update firstName if provided
    if (firstName !== undefined) {
      user.firstName = firstName;
    }

    // Update lastName if provided
    if (lastName !== undefined) {
      user.lastName = lastName;
    }

    // Update name if provided (will be auto-generated from firstName+lastName in pre-save hook if not provided)
    if (name !== undefined) {
      updateData.name = name;
    }

    // Update email if provided and different
    if (email && email !== oldEmail) {
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

    // Apply updates
    if (Object.keys(updateData).length > 0) {
      Object.assign(user, updateData);
    }

    await user.save();

    // Send email change notification if email was changed
    // Note: oldEmail is checked for truthiness in the condition, ensuring type safety
    if (email && oldEmail && email !== oldEmail) {
      try {
        const displayName = user.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
        // oldEmail is guaranteed to be defined here due to the condition above
        await sendEmailChangedNotification(
          oldEmail,
          email,
          displayName
        );
      } catch (emailError) {
        console.error('Failed to send email change notification:', emailError);
        // Don't fail the request if email fails
      }
    }

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

    // Send session revoked notification
    try {
      await sendSessionRevokedNotification(
        user.email!,
        user.name || `${user.firstName} ${user.lastName}`,
        {
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          revokedAt: new Date().toLocaleString(),
        }
      );
    } catch (emailError) {
      console.error('Failed to send session revoked notification:', emailError);
      // Don't fail the request if email fails
    }

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

// POST /api/users/account/deactivate - Deactivate account
router.post('/account/deactivate', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      return res.status(400).json({
        success: false,
        error: 'This account is already deactivated. You can reactivate it using the "Reactivate Account" option.',
      });
    }

    // Deactivate account
    user.accountStatus = AccountStatus.DEACTIVATED;
    user.deactivatedAt = new Date();
    user.isActive = false;
    
    // Increment token version to invalidate all tokens
    user.tokenVersion += 1;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    // Send deactivation email
    try {
      await sendAccountDeactivationEmail(
        user.email!,
        user.name || `${user.firstName} ${user.lastName}`
      );
    } catch (emailError) {
      console.error('Failed to send deactivation email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Account deactivated successfully. You can reactivate it anytime.',
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate account',
    });
  }
});

// POST /api/users/account/delete - Request account deletion
router.post('/account/delete', authenticate, [
  body('password').notEmpty().withMessage('Password is required'),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
    }

    if (user.accountStatus === AccountStatus.DELETED) {
      return res.status(400).json({
        success: false,
        error: 'This account is already scheduled for deletion. You can cancel it using the "Cancel Deletion" option.',
      });
    }

    // Store user info before deletion
    const userEmail = user.email;
    const userName = user.name || `${user.firstName} ${user.lastName}`.trim() || 'User';

    // Schedule deletion for 30 days from now
    user.accountStatus = AccountStatus.DELETED;
    user.scheduledDeletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    user.isActive = false;
    
    // Increment token version to invalidate all tokens
    user.tokenVersion += 1;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    // Send deletion confirmation email (only if email exists)
    if (userEmail) {
      try {
        await sendAccountDeletionEmail(userEmail, userName);
      } catch (emailError) {
        console.error('Failed to send deletion email:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn('Account deletion completed but email is missing, cannot send confirmation email.');
    }

    res.json({
      success: true,
      message: 'Account deletion scheduled for 30 days from now. You can cancel this within 30 days using the "Cancel Deletion" option.',
      data: {
        scheduledDeletionDate: user.scheduledDeletionDate,
      },
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
});

// POST /api/users/account/cancel-deletion - Cancel account deletion
router.post('/account/cancel-deletion', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.accountStatus !== AccountStatus.DELETED) {
      return res.status(400).json({
        success: false,
        error: 'This account is not scheduled for deletion. Only accounts with pending deletion can be cancelled.',
      });
    }

    // Check if still within 30-day grace period
    if (user.scheduledDeletionDate && user.scheduledDeletionDate < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'The 30-day grace period has expired. Your account cannot be restored. Please contact support if you need assistance.',
      });
    }

    // Cancel deletion
    user.accountStatus = AccountStatus.ACTIVE;
    user.scheduledDeletionDate = undefined;
    user.isActive = true;
    await user.save();

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully. Your account is now active.',
    });
  } catch (error) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel account deletion',
    });
  }
});

export default router;