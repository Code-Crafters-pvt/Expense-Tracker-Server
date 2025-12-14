import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { passwordChangeLimiter, accountReactivateLimiter, accountReactivateFailureLimiter } from '../middleware/rateLimiter';
import {
  sendPasswordChangedNotification,
  sendEmailChangedNotification,
  sendEmailChangeVerification,
  sendAccountDeletionEmail,
  sendAccountReactivationEmail,
  sendAccountDeactivationEmail,
  sendSessionRevokedNotification,
} from '../services/email';
import { RefreshToken } from '../models/RefreshToken';
import { AccountStatus } from '../enums/AccountStatus';
import crypto from 'crypto';

const router = express.Router();

// POST /api/users/account/reactivate - Reactivate account (public endpoint)
router.post('/account/reactivate', accountReactivateFailureLimiter, accountReactivateLimiter, [
  body('email')
    .isEmail({ allow_display_name: false, require_tld: true })
    .withMessage('Please enter a valid email')
    .trim()
    .toLowerCase(),
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

    user.accountStatus = AccountStatus.ACTIVE;
    user.deactivatedAt = undefined;
    user.isActive = true;
    await user.save();

    if (user.email) {
      try {
        await sendAccountReactivationEmail(
          user.email,
          user.name || `${user.firstName} ${user.lastName}`
        );
      } catch (emailError) {
        console.error('Failed to send reactivation email:', emailError);
      }
    } else {
      console.error('User email is missing, cannot send reactivation email');
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
    .isEmail({ allow_display_name: false, require_tld: true })
    .withMessage('Please enter a valid email')
    .trim()
    .toLowerCase(),
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
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const isValidPassword = await user.comparePassword(currentPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
        });
      }

      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          error: 'New password must be different from current password',
        });
      }

      const changeTimestamp = new Date();

      user.password = newPassword;
      user.tokenVersion += 1;
      await user.save();

      await RefreshToken.updateMany(
        { userId: user._id, isRevoked: false },
        { isRevoked: true }
      );

      if (user.email) {
        try {
          await sendPasswordChangedNotification(
            user.email,
            user.name ?? "",
            changeTimestamp
          );
        } catch (emailError) {
          console.error('Failed to send password changed notification:', emailError);
        }
      } else {
        console.error('User email is missing, cannot send password changed notification');
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

// PUT /api/users/profile - Update user profile
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

    const { firstName, lastName, name, email } = req.body; // email is now lowercased but dots preserved
    const user = await User.findById(req.user._id).select('+emailChangeToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const oldEmail = user.email;
    let emailChangeInitiated = false;
    let emailChangeToken: string | undefined;

    // Update firstName, lastName, name immediately
    if (firstName !== undefined) {
      user.firstName = firstName;
    }

    if (lastName !== undefined) {
      user.lastName = lastName;
    }

    if (name !== undefined) {
      user.name = name;
    }

    // Handle email change - requires verification
    if (email && email !== oldEmail) {
      // Check if email is already in use by another user (use normalized email for duplicate check)
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          error: 'Email is already in use',
        });
      }

      // Check if there's already a pending email change (use normalized email for comparison)
      if (user.pendingEmail && user.pendingEmail === email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'A verification email has already been sent to this address. Please check your inbox or wait for the current verification to expire.',
        });
      }

      // Generate email change verification token
      emailChangeToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(emailChangeToken)
        .digest('hex');

      // Store pending email and token (use normalized email for storage to prevent duplicates)
      user.pendingEmail = email.toLowerCase();
      user.emailChangeToken = hashedToken;
      user.emailChangeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      emailChangeInitiated = true;
    }

    // Save user first (like registration flow)
    await user.save();

    // Send verification email to the new email address (after saving)
    // Use same pattern as registration - use stored email from user object
    if (emailChangeInitiated && user.pendingEmail) {
      const verificationUrl = `${process.env.APP_URL || 'http://localhost:19006'}/verify-email-change?token=${emailChangeToken}`;
      let emailSent = false;

      if (user.pendingEmail) {
        try {
          const displayName = user.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
          await sendEmailChangeVerification(
            user.pendingEmail,
            displayName,
            verificationUrl
          );
          emailSent = true;
        } catch (emailError) {
          console.error('Failed to send email change verification:', emailError);
        }
      } else {
        console.error('Pending email is missing, cannot send verification email.');
      }
    }

    // Return appropriate response
    if (emailChangeInitiated) {
      return res.json({
        success: true,
        message: 'Profile updated successfully. A verification email has been sent to your new email address. Please verify it to complete the email change.',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email, // Still shows old email until verified
            pendingEmail: user.pendingEmail,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          requiresEmailVerification: true,
        },
      });
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

// POST /api/users/verify-email-change - Verify email change
router.post(
  '/verify-email-change',
  authenticate,
  [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required'),
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

      const { token } = req.body;

      // Hash the provided token to match stored hash
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find user with matching token and non-expired date
      const user = await User.findById(req.user._id)
        .select('+emailChangeToken +pendingEmail');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Verify token matches and hasn't expired
      if (
        !user.emailChangeToken ||
        user.emailChangeToken !== hashedToken ||
        !user.emailChangeExpires ||
        user.emailChangeExpires < new Date()
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token',
        });
      }

      if (!user.pendingEmail) {
        return res.status(400).json({
          success: false,
          error: 'No pending email change found',
        });
      }

      // Check if the pending email is already in use by another account
      const existingUser = await User.findOne({ 
        email: user.pendingEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        // Clear the pending email change
        user.pendingEmail = undefined;
        user.emailChangeToken = undefined;
        user.emailChangeExpires = undefined;
        await user.save();

        return res.status(400).json({
          success: false,
          error: 'This email address is already in use by another account. Please choose a different email.',
        });
      }

      const oldEmail = user.email;
      const newEmail = user.pendingEmail;
      const changeTimestamp = new Date();

      // Update email from pendingEmail to email
      user.email = newEmail;
      user.pendingEmail = undefined;
      user.emailChangeToken = undefined;
      user.emailChangeExpires = undefined;

      // If account was pending verification, activate it now
      if (user.accountStatus === AccountStatus.PENDING_VERIFICATION) {
        user.accountStatus = AccountStatus.ACTIVE;
      }

      await user.save();

      // Send notification to both old and new email
      try {
        const displayName = user.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
        await sendEmailChangedNotification(
          oldEmail,
          newEmail,
          displayName,
          changeTimestamp
        );
      } catch (emailError) {
        console.error('Failed to send email change notification:', emailError);
        // Don't fail the verification if email fails
      }

      return res.json({
        success: true,
        message: 'Email address verified and updated successfully',
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
      console.error('Verify email change error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during email change verification',
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
    
    const sessions = await RefreshToken.find({
      userId: user._id,
      isRevoked: false,
    })
      .select('deviceInfo ipAddress userAgent createdAt expiresAt')
      .sort({ createdAt: -1 })
      .lean();

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

    const revokedAt = new Date();

    session.isRevoked = true;
    await session.save();

    if (user.email) {
      try {
        await sendSessionRevokedNotification(
          user.email,
          user.name || `${user.firstName} ${user.lastName}`,
          {
            deviceInfo: session.deviceInfo,
            ipAddress: session.ipAddress,
            revokedAt,
          }
        );
      } catch (emailError) {
        console.error('Failed to send session revoked notification:', emailError);
      }
    } else {
      console.error('User email is missing, cannot send session revoked notification');
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
    user.tokenVersion += 1;
    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    if (user.email) {
      try {
        await sendAccountDeactivationEmail(
          user.email,
          user.name || `${user.firstName} ${user.lastName}`
        );
      } catch (emailError) {
        console.error('Failed to send deactivation email:', emailError);
      }
    } else {
      console.error('User email is missing, cannot send deactivation email');
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

    const userEmail = user.email;
    const userName = user.name || `${user.firstName} ${user.lastName}`.trim() || 'User';

    user.accountStatus = AccountStatus.DELETED;
    user.scheduledDeletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.isActive = false;
    user.tokenVersion += 1;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    if (userEmail) {
      try {
        await sendAccountDeletionEmail(userEmail, userName);
      } catch (emailError) {
        console.error('Failed to send deletion email:', emailError);
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

    user.accountStatus = AccountStatus.ACTIVE;
    user.scheduledDeletionDate = undefined;
    user.isActive = true;
    user.tokenVersion += 1;
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully. Your account is now active. Please log in again.',
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