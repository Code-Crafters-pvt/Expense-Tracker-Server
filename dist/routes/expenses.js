"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const expenseService_1 = require("../services/expenseService");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
const validateExpense = [
    (0, express_validator_1.body)('amount')
        .isFloat({ min: 0.01, max: 999999.99 })
        .withMessage('Amount must be between 0.01 and 999,999.99'),
    (0, express_validator_1.body)('description')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Description must be between 1 and 200 characters'),
    (0, express_validator_1.body)('category')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Category must be between 1 and 50 characters'),
    (0, express_validator_1.body)('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be a valid ISO 8601 date'),
    (0, express_validator_1.body)('isRecurring')
        .optional()
        .isBoolean()
        .withMessage('isRecurring must be a boolean'),
    (0, express_validator_1.body)('recurringType')
        .optional()
        .isIn(['daily', 'weekly', 'monthly', 'yearly'])
        .withMessage('Invalid recurring type'),
    (0, express_validator_1.body)('recurringEndDate')
        .optional()
        .isISO8601()
        .withMessage('Recurring end date must be a valid ISO 8601 date')
        .custom((value, { req }) => {
        if (req.body.isRecurring && !value) {
            throw new Error('Recurring end date is required for recurring expenses');
        }
        if (value && new Date(value) <= new Date(req.body.date || new Date())) {
            throw new Error('Recurring end date must be after the start date');
        }
        return true;
    })
];
router.get('/', [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('category')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Category must be between 1 and 50 characters'),
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            category: req.query.category,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            isRecurring: req.query.isRecurring === 'true' ? true : req.query.isRecurring === 'false' ? false : undefined,
        };
        const result = await expenseService_1.expenseService.getExpenses(req.user._id, filters, { page, limit });
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching expenses'
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const expense = await expenseService_1.expenseService.getExpense(req.user._id, req.params.id);
        res.json({
            success: true,
            data: { expense }
        });
    }
    catch (error) {
        console.error('Get expense error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching expense'
        });
    }
});
router.post('/', validateExpense, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { amount, description, category, date, isRecurring, recurringType, recurringEndDate } = req.body;
        const expense = await expenseService_1.expenseService.createExpense(req.user._id, {
            amount: parseFloat(amount),
            description,
            category,
            date: date ? new Date(date) : new Date(),
            isRecurring,
            recurringType,
            recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : undefined
        });
        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            data: { expense }
        });
    }
    catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while creating expense'
        });
    }
});
router.put('/:id', validateExpense, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { amount, description, category, date, isRecurring, recurringType, recurringEndDate } = req.body;
        const expense = await expenseService_1.expenseService.updateExpense(req.user._id, req.params.id, {
            amount: parseFloat(amount),
            description,
            category,
            date: date ? new Date(date) : new Date(),
            isRecurring,
            recurringType,
            recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : undefined
        });
        res.json({
            success: true,
            message: 'Expense updated successfully',
            data: { expense }
        });
    }
    catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while updating expense'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const deleteAllInstances = req.query.deleteAllInstances === 'true';
        await expenseService_1.expenseService.deleteExpense(req.user._id, req.params.id, deleteAllInstances);
        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while deleting expense'
        });
    }
});
exports.default = router;
//# sourceMappingURL=expenses.js.map