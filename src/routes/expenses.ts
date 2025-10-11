import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Expense } from '../models/Expense';
import { authenticate, AuthRequest } from '../middleware/auth';
import { expenseService } from '../services/expenseService';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation middleware
const validateExpense = [
  body('amount')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Amount must be between 0.01 and 999,999.99'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  body('category')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  body('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('isRecurring must be a boolean'),
  body('recurringType')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Invalid recurring type'),
  body('recurringEndDate')
    .optional()
    .isISO8601()
    .withMessage('Recurring end date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.body.isRecurring && !value) {
        throw new Error(
          'Recurring end date is required for recurring expenses'
        );
      }
      if (value && new Date(value) <= new Date(req.body.date || new Date())) {
        throw new Error('Recurring end date must be after the start date');
      }
      return true;
    }),
];

// Get all expenses for the authenticated user
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('category')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
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

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        category: req.query.category as string | undefined,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        isRecurring:
          req.query.isRecurring === 'true'
            ? true
            : req.query.isRecurring === 'false'
              ? false
              : undefined,
      };

      const result = await expenseService.getExpenses(req.user._id, filters, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get expenses error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error while fetching expenses',
      });
    }
  }
);

// Get expense by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const expense = await expenseService.getExpense(
      req.user._id,
      req.params.id
    );

    res.json({
      success: true,
      data: { expense },
    });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching expense',
    });
  }
});

// Create new expense
router.post('/', validateExpense, async (req: AuthRequest, res) => {
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

    const {
      amount,
      description,
      category,
      date,
      isRecurring,
      recurringType,
      recurringEndDate,
    } = req.body;

    const expense = await expenseService.createExpense(req.user._id, {
      amount: parseFloat(amount),
      description,
      category,
      date: date ? new Date(date) : new Date(),
      isRecurring,
      recurringType,
      recurringEndDate: recurringEndDate
        ? new Date(recurringEndDate)
        : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: { expense },
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating expense',
    });
  }
});

// Update expense
router.put('/:id', validateExpense, async (req: AuthRequest, res) => {
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

    const {
      amount,
      description,
      category,
      date,
      isRecurring,
      recurringType,
      recurringEndDate,
    } = req.body;

    const expense = await expenseService.updateExpense(
      req.user._id,
      req.params.id,
      {
        amount: parseFloat(amount),
        description,
        category,
        date: date ? new Date(date) : new Date(),
        isRecurring,
        recurringType,
        recurringEndDate: recurringEndDate
          ? new Date(recurringEndDate)
          : undefined,
      }
    );

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: { expense },
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating expense',
    });
  }
});

// Delete expense
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const deleteAllInstances = req.query.deleteAllInstances === 'true';
    await expenseService.deleteExpense(
      req.user._id,
      req.params.id,
      deleteAllInstances
    );

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting expense',
    });
  }
});

export default router;
