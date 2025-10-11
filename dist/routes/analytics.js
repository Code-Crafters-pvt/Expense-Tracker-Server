"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Expense_1 = require("../models/Expense");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
const validateDateRange = [
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
];
router.get('/overview', validateDateRange, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const filter = {
            userId: req.user._id,
            date: {
                $gte: startDate,
                $lte: endDate
            }
        };
        const totalSpending = await Expense_1.Expense.aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const expenseCount = await Expense_1.Expense.countDocuments(filter);
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const avgPerDay = totalSpending.length > 0 ? totalSpending[0].total / Math.max(daysDiff, 1) : 0;
        const spendingByCategory = await Expense_1.Expense.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);
        const dailySpending = await Expense_1.Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        $lte: new Date()
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        day: { $dayOfMonth: '$date' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
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
                        days: daysDiff
                    }
                },
                spendingByCategory,
                dailySpending
            }
        });
    }
    catch (error) {
        console.error('Analytics overview error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching analytics overview'
        });
    }
});
router.get('/by-category', validateDateRange, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const spendingByCategory = await Expense_1.Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' }
                }
            },
            {
                $addFields: {
                    percentage: {
                        $multiply: [
                            {
                                $divide: [
                                    '$total',
                                    {
                                        $sum: '$total'
                                    }
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            { $sort: { total: -1 } }
        ]);
        const totalSpending = spendingByCategory.reduce((sum, category) => sum + category.total, 0);
        const categoriesWithPercentage = spendingByCategory.map(category => ({
            ...category,
            percentage: totalSpending > 0 ? Math.round((category.total / totalSpending) * 100 * 100) / 100 : 0
        }));
        res.json({
            success: true,
            data: {
                categories: categoriesWithPercentage,
                totalSpending,
                period: {
                    startDate,
                    endDate
                }
            }
        });
    }
    catch (error) {
        console.error('Category analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching category analytics'
        });
    }
});
router.get('/monthly-trends', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 6;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const monthlySpending = await Expense_1.Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        const formattedData = monthlySpending.map(item => ({
            year: item._id.year,
            month: item._id.month,
            monthName: new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'long' }),
            total: item.total,
            count: item.count
        }));
        res.json({
            success: true,
            data: {
                monthlySpending: formattedData,
                period: {
                    months,
                    startDate,
                    endDate: new Date()
                }
            }
        });
    }
    catch (error) {
        console.error('Monthly trends error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching monthly trends'
        });
    }
});
router.get('/recent-summary', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const recentExpenses = await Expense_1.Expense.find({
            userId: req.user._id,
            date: { $gte: startDate }
        })
            .sort({ date: -1 })
            .limit(10);
        const totalSpending = await Expense_1.Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const topCategories = await Expense_1.Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } },
            { $limit: 5 }
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
                    endDate: new Date()
                }
            }
        });
    }
    catch (error) {
        console.error('Recent summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching recent summary'
        });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map