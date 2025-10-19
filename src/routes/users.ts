import express from 'express';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validatePasswordComplexity } from '../utils/passwordValidator';
import { passwordChangeLimiter } from '../middleware/rateLimiter';
import { sendPasswordChangedNotification } from '../services/emailService';

const router = express.Router();

// All routes require authentication
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

// GET /api/users/profile - Get user profile
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile',
    });
  }
});

// POST /api/users/change-password - Change user password
router.post(
  '/change-password',
  passwordChangeLimiter,
  validateChangePassword,
  async (req: AuthRequest, res) => {
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

      const { currentPassword, newPassword } = req.body;

      // Get user with password (password is excluded by default)
      const user = await User.findById(req.user._id)
      .select('+password +passwordHistory');
      
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

      const isInHistory = await user.isPasswordInHistory(newPassword);
      if (isInHistory) {
        return res.status(400).json({
          success: false,
          error: 'You cannot reuse any of your last 3 passwords. Please choose a different password.',
        });
      }

      await user.addPasswordToHistory();

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      try {
        await sendPasswordChangedNotification(user.email, user.name);
      } catch (emailError) {
        console.error('Failed to send password changed notification:', emailError);
      }

      // TODO - Invalidate all refresh tokens (logout other devices)
      // This would require storing refresh tokens in database
      // For now, just return success

      res.json({
        success: true,
        message: 'Password changed successfully. For security, please log in again on other devices.',
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

export default router;