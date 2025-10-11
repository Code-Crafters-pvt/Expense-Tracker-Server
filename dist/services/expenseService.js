"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseService = void 0;
const Expense_1 = require("../models/Expense");
const recurringExpenseService_1 = require("./recurringExpenseService");
const date_fns_1 = require("date-fns");
class ExpenseService {
    async createExpense(userId, expenseData) {
        try {
            const expense = new Expense_1.Expense({
                userId,
                ...expenseData,
            });
            await expense.save();
            if (expense.isRecurring) {
                const endDate = expense.recurringEndDate || (0, date_fns_1.endOfYear)(new Date());
                await recurringExpenseService_1.recurringExpenseService.generateRecurringExpenses(userId, expense.date, endDate);
            }
            return expense;
        }
        catch (error) {
            console.error('Error creating expense:', error);
            throw error;
        }
    }
    async getExpenses(userId, filters = {}, pagination = { page: 1, limit: 20 }) {
        try {
            const query = { userId };
            if (filters.category) {
                query.category = filters.category;
            }
            if (filters.startDate || filters.endDate) {
                query.date = {};
                if (filters.startDate) {
                    query.date.$gte = filters.startDate;
                }
                if (filters.endDate) {
                    query.date.$lte = filters.endDate;
                }
            }
            if (typeof filters.isRecurring === 'boolean') {
                query.isRecurring = filters.isRecurring;
            }
            const total = await Expense_1.Expense.countDocuments(query);
            const pages = Math.ceil(total / pagination.limit);
            const expenses = await Expense_1.Expense.find(query)
                .sort({ date: -1 })
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit);
            return {
                expenses,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    pages,
                    hasNext: pagination.page < pages,
                    hasPrev: pagination.page > 1,
                },
            };
        }
        catch (error) {
            console.error('Error fetching expenses:', error);
            throw error;
        }
    }
    async getExpense(userId, expenseId) {
        try {
            const expense = await Expense_1.Expense.findOne({ _id: expenseId, userId });
            if (!expense) {
                throw new Error('Expense not found');
            }
            return expense;
        }
        catch (error) {
            console.error('Error fetching expense:', error);
            throw error;
        }
    }
    async updateExpense(userId, expenseId, updates) {
        try {
            const expense = await Expense_1.Expense.findOne({ _id: expenseId, userId });
            if (!expense) {
                throw new Error('Expense not found');
            }
            if (expense.isRecurring) {
                return recurringExpenseService_1.recurringExpenseService.updateRecurringExpense(expenseId, updates);
            }
            Object.assign(expense, updates);
            await expense.save();
            return expense;
        }
        catch (error) {
            console.error('Error updating expense:', error);
            throw error;
        }
    }
    async deleteExpense(userId, expenseId, deleteAllInstances = false) {
        try {
            const expense = await Expense_1.Expense.findOne({ _id: expenseId, userId });
            if (!expense) {
                throw new Error('Expense not found');
            }
            if (expense.isRecurring) {
                await recurringExpenseService_1.recurringExpenseService.deleteRecurringExpense(expenseId, deleteAllInstances);
                return;
            }
            await expense.deleteOne();
        }
        catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }
    async getMonthlyTotal(userId, date = new Date()) {
        try {
            const start = (0, date_fns_1.startOfMonth)(date);
            const end = (0, date_fns_1.endOfMonth)(date);
            const result = await Expense_1.Expense.aggregate([
                {
                    $match: {
                        userId,
                        date: { $gte: start, $lte: end },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                    },
                },
            ]);
            return result[0]?.total || 0;
        }
        catch (error) {
            console.error('Error calculating monthly total:', error);
            throw error;
        }
    }
    async getCategoryTotals(userId, startDate, endDate) {
        try {
            const match = { userId };
            if (startDate || endDate) {
                match.date = {};
                if (startDate)
                    match.date.$gte = startDate;
                if (endDate)
                    match.date.$lte = endDate;
            }
            const result = await Expense_1.Expense.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { total: -1 } },
            ]);
            return result;
        }
        catch (error) {
            console.error('Error calculating category totals:', error);
            throw error;
        }
    }
}
exports.expenseService = new ExpenseService();
//# sourceMappingURL=expenseService.js.map