"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recurringExpenseService = void 0;
const Expense_1 = require("../models/Expense");
const date_fns_1 = require("date-fns");
class RecurringExpenseService {
    async generateRecurringExpenses(userId, startDate, endDate) {
        try {
            const recurringExpenses = await Expense_1.Expense.find({
                userId,
                isRecurring: true,
                parentExpenseId: { $exists: false },
            });
            const generatedExpenses = [];
            for (const expense of recurringExpenses) {
                if (expense.recurringEndDate && expense.recurringEndDate < startDate) {
                    continue;
                }
                let currentDate = new Date(expense.date);
                while (currentDate <= endDate) {
                    if (expense.recurringEndDate && currentDate > expense.recurringEndDate) {
                        break;
                    }
                    const newExpense = new Expense_1.Expense({
                        userId: expense.userId,
                        amount: expense.amount,
                        description: expense.description,
                        category: expense.category,
                        date: currentDate,
                        isRecurring: false,
                        parentExpenseId: expense._id,
                    });
                    generatedExpenses.push(newExpense);
                    switch (expense.recurringType) {
                        case 'daily':
                            currentDate = (0, date_fns_1.addDays)(currentDate, 1);
                            break;
                        case 'weekly':
                            currentDate = (0, date_fns_1.addWeeks)(currentDate, 1);
                            break;
                        case 'monthly':
                            currentDate = (0, date_fns_1.addMonths)(currentDate, 1);
                            break;
                        case 'yearly':
                            currentDate = (0, date_fns_1.addYears)(currentDate, 1);
                            break;
                        default:
                            throw new Error(`Invalid recurring type: ${expense.recurringType}`);
                    }
                }
            }
            if (generatedExpenses.length > 0) {
                await Expense_1.Expense.insertMany(generatedExpenses);
            }
            return generatedExpenses;
        }
        catch (error) {
            console.error('Error generating recurring expenses:', error);
            throw error;
        }
    }
    async updateRecurringExpense(expenseId, updates) {
        try {
            const expense = await Expense_1.Expense.findById(expenseId);
            if (!expense) {
                throw new Error('Expense not found');
            }
            if (!expense.isRecurring) {
                throw new Error('Not a recurring expense');
            }
            Object.assign(expense, updates);
            await expense.save();
            if (updates.amount || updates.description || updates.category) {
                await Expense_1.Expense.updateMany({
                    parentExpenseId: expense._id,
                    date: { $gt: new Date() },
                }, {
                    $set: {
                        amount: updates.amount,
                        description: updates.description,
                        category: updates.category,
                    },
                });
            }
            return expense;
        }
        catch (error) {
            console.error('Error updating recurring expense:', error);
            throw error;
        }
    }
    async deleteRecurringExpense(expenseId, deleteAllInstances = false) {
        try {
            const expense = await Expense_1.Expense.findById(expenseId);
            if (!expense) {
                throw new Error('Expense not found');
            }
            if (!expense.isRecurring) {
                throw new Error('Not a recurring expense');
            }
            await expense.deleteOne();
            if (deleteAllInstances) {
                await Expense_1.Expense.deleteMany({ parentExpenseId: expense._id });
            }
            else {
                await Expense_1.Expense.deleteMany({
                    parentExpenseId: expense._id,
                    date: { $gt: new Date() },
                });
            }
        }
        catch (error) {
            console.error('Error deleting recurring expense:', error);
            throw error;
        }
    }
}
exports.recurringExpenseService = new RecurringExpenseService();
//# sourceMappingURL=recurringExpenseService.js.map