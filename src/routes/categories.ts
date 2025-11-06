import express from 'express';
import { body, validationResult } from 'express-validator';
import { Category } from '../models/Category';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation middleware
const validateCategory = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category name must be between 1 and 50 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  body('icon')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Icon must be between 1 and 10 characters'),
];

// Get all categories (default + user's custom categories)
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const defaultCategories = await Category.find({ isDefault: true });
    const userCategories = await Category.find({
      userId: req.user._id.toString(),
      isDefault: false,
    });

    const categories = [...defaultCategories, ...userCategories];

    res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching categories',
    });
  }
});

// Create custom category
router.post('/', validateCategory, async (req: AuthRequest, res) => {
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

    const { name, color, icon } = req.body;

    // Check if category with same name already exists for this user
    const existingCategory = await Category.findOne({
      name: name.toLowerCase(),
      userId: req.user._id.toString(),
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: 'Category with this name already exists',
      });
    }

    const category = new Category({
      name: name.toLowerCase(),
      color: color || '#3B82F6',
      icon: icon || '💰',
      userId: req.user._id,
      isDefault: false,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating category',
    });
  }
});

// Update custom category
router.put('/:id', validateCategory, async (req: AuthRequest, res) => {
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

    const { name, color, icon } = req.body;

    const category = await Category.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id.toString(),
        isDefault: false, // Can't update default categories
      },
      {
        name: name.toLowerCase(),
        color: color || '#3B82F6',
        icon: icon || '💰',
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or cannot be updated',
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating category',
    });
  }
});

// Delete custom category
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id.toString(),
      isDefault: false, // Can't delete default categories
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or cannot be deleted',
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting category',
    });
  }
});

// Initialize default categories (admin endpoint)
router.post('/init-defaults', async (req: AuthRequest, res) => {
  try {
    // Check if default categories already exist
    const existingDefaults = await Category.find({ isDefault: true });

    if (existingDefaults.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Default categories already exist',
      });
    }

    const defaultCategories = Category.getDefaultCategories();
    const categories = await Category.insertMany(defaultCategories);

    res.status(201).json({
      success: true,
      message: 'Default categories initialized successfully',
      data: { categories },
    });
  } catch (error) {
    console.error('Init defaults error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while initializing default categories',
    });
  }
});

export default router;
