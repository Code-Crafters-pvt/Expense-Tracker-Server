import { Expense, IExpense } from '../models/Expense';
import { recurringExpenseService } from './recurringExpenseService';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface ExpenseFilters {
  category?: string;
  startDate?: Date;
  endDate?: Date;
  isRecurring?: boolean;
}

interface PaginationOptions {
  page: number;
  limit: number;
}

class ExpenseService {
  async createExpense(userId: string, expenseData: Partial<IExpense>) {
    try {
      const expense = new Expense({
        userId,
        ...expenseData,
      });

      await expense.save();

      // If it's a recurring expense, generate instances for the next period
      if (expense.isRecurring) {
        const endDate = expense.recurringEndDate || endOfYear(new Date());
        await recurringExpenseService.generateRecurringExpenses(
          userId,
          expense.date,
          endDate
        );
      }

      return expense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async getExpenses(
    userId: string,
    filters: ExpenseFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ) {
    try {
      const query: any = { userId };

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

      const total = await Expense.countDocuments(query);
      const pages = Math.ceil(total / pagination.limit);

      const expenses = await Expense.find(query)
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
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }
  }

  async getExpense(userId: string, expenseId: string) {
    try {
      const expense = await Expense.findOne({ _id: expenseId, userId });
      if (!expense) {
        throw new Error('Expense not found');
      }
      return expense;
    } catch (error) {
      console.error('Error fetching expense:', error);
      throw error;
    }
  }

  async updateExpense(
    userId: string,
    expenseId: string,
    updates: Partial<IExpense>
  ) {
    try {
      const expense = await Expense.findOne({ _id: expenseId, userId });
      if (!expense) {
        throw new Error('Expense not found');
      }

      // If it's a recurring expense, use the recurring service
      if (expense.isRecurring) {
        return recurringExpenseService.updateRecurringExpense(
          expenseId,
          updates
        );
      }

      // Regular expense update
      Object.assign(expense, updates);
      await expense.save();

      return expense;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(
    userId: string,
    expenseId: string,
    deleteAllInstances = false
  ) {
    try {
      const expense = await Expense.findOne({ _id: expenseId, userId });
      if (!expense) {
        throw new Error('Expense not found');
      }

      // If it's a recurring expense, use the recurring service
      if (expense.isRecurring) {
        await recurringExpenseService.deleteRecurringExpense(
          expenseId,
          deleteAllInstances
        );
        return;
      }

      // Regular expense deletion
      await expense.deleteOne();
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async getMonthlyTotal(userId: string, date = new Date()) {
    try {
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const result = await Expense.aggregate([
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
    } catch (error) {
      console.error('Error calculating monthly total:', error);
      throw error;
    }
  }

  async getCategoryTotals(userId: string, startDate?: Date, endDate?: Date) {
    try {
      const match: any = { userId };
      if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = startDate;
        if (endDate) match.date.$lte = endDate;
      }

      const result = await Expense.aggregate([
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
    } catch (error) {
      console.error('Error calculating category totals:', error);
      throw error;
    }
  }
}

export const expenseService = new ExpenseService();
