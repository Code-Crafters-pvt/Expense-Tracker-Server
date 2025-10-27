import express from 'express';
import { query, validationResult } from 'express-validator';
import { Expense } from '../models/Expense';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation middleware
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

// Get spending overview
router.get('/overview', validateDateRange, async (req: AuthRequest, res) => {
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

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    // Build filter
    const filter = {
      userId: req.user._id.toString(),
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Get total spending
    const totalSpending = await Expense.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Get expense count
    const expenseCount = await Expense.countDocuments(filter);

    // Get average spending per day
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const avgPerDay =
      totalSpending.length > 0
        ? totalSpending[0].total / Math.max(daysDiff, 1)
        : 0;

    // Get spending by category
    const spendingByCategory = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Get daily spending for the last 30 days
    const dailySpending = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id.toString(),
          date: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            $lte: new Date(),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' },
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalSpending: totalSpending.length > 0 ? totalSpending[0].total : 0,
          expenseCount,
          avgPerDay: Math.round(avgPerDay * 100) / 100,
          period: {
            startDate,
            endDate,
            days: daysDiff,
          },
        },
        spendingByCategory,
        dailySpending,
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching analytics overview',
    });
  }
});

// Get spending by category
router.get('/by-category', validateDateRange, async (req: AuthRequest, res) => {
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

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const spendingByCategory = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id.toString(),
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      {
        $addFields: {
          percentage: {
            $multiply: [
              {
                $divide: [
                  '$total',
                  {
                    $sum: '$total',
                  },
                ],
              },
              100,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Calculate total for percentage calculation
    const totalSpending = spendingByCategory.reduce(
      (sum, category) => sum + category.total,
      0
    );

    // Add percentage to each category
    const categoriesWithPercentage = spendingByCategory.map(category => ({
      ...category,
      percentage:
        totalSpending > 0
          ? Math.round((category.total / totalSpending) * 100 * 100) / 100
          : 0,
    }));

    res.json({
      success: true,
      data: {
        categories: categoriesWithPercentage,
        totalSpending,
        period: {
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('Category analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching category analytics',
    });
  }
});

// Get monthly spending trends
router.get('/monthly-trends', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const months = parseInt(req.query.months as string) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const monthlySpending = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id.toString(),
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Format the data for easier consumption
    const formattedData = monthlySpending.map(item => ({
      year: item._id.year,
      month: item._id.month,
      monthName: new Date(item._id.year, item._id.month - 1).toLocaleString(
        'default',
        { month: 'long' }
      ),
      total: item.total,
      count: item.count,
    }));

    res.json({
      success: true,
      data: {
        monthlySpending: formattedData,
        period: {
          months,
          startDate,
          endDate: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('Monthly trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching monthly trends',
    });
  }
});

// Get recent expenses summary
router.get('/recent-summary', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent expenses
    const recentExpenses = await Expense.find({
      userId: req.user._id.toString(),
      date: { $gte: startDate },
    })
      .sort({ date: -1 })
      .limit(10);

    // Get total for the period
    const totalSpending = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id.toString(),
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Get top categories for the period
    const topCategories = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id.toString(),
          date: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: {
        recentExpenses,
        totalSpending: totalSpending.length > 0 ? totalSpending[0].total : 0,
        topCategories,
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
      },
    });
  } catch (error) {
    console.error('Recent summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching recent summary',
    });
  }
});

export default router;
