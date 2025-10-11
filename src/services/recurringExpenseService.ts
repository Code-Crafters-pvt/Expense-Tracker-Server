import { Expense, IExpense } from '../models/Expense';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

class RecurringExpenseService {
  async generateRecurringExpenses(
    userId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      // Find all recurring expenses for the user
      const recurringExpenses = await Expense.find({
        userId,
        isRecurring: true,
        parentExpenseId: { $exists: false }, // Only get parent expenses
      });

      const generatedExpenses: IExpense[] = [];

      for (const expense of recurringExpenses) {
        // Skip if the recurring end date is before our start date
        if (expense.recurringEndDate && expense.recurringEndDate < startDate) {
          continue;
        }

        // Generate recurring instances
        let currentDate = new Date(expense.date);
        while (currentDate <= endDate) {
          // Skip if we've passed the recurring end date
          if (
            expense.recurringEndDate &&
            currentDate > expense.recurringEndDate
          ) {
            break;
          }

          // Create a new expense instance
          const newExpense = new Expense({
            userId: expense.userId,
            amount: expense.amount,
            description: expense.description,
            category: expense.category,
            date: currentDate,
            isRecurring: false,
            parentExpenseId: expense._id,
          });

          generatedExpenses.push(newExpense);

          // Calculate next date based on recurring type
          switch (expense.recurringType) {
            case 'daily':
              currentDate = addDays(currentDate, 1);
              break;
            case 'weekly':
              currentDate = addWeeks(currentDate, 1);
              break;
            case 'monthly':
              currentDate = addMonths(currentDate, 1);
              break;
            case 'yearly':
              currentDate = addYears(currentDate, 1);
              break;
            default:
              throw new Error(
                `Invalid recurring type: ${expense.recurringType}`
              );
          }
        }
      }

      // Save all generated expenses
      if (generatedExpenses.length > 0) {
        await Expense.insertMany(generatedExpenses);
      }

      return generatedExpenses;
    } catch (error) {
      console.error('Error generating recurring expenses:', error);
      throw error;
    }
  }

  async updateRecurringExpense(expenseId: string, updates: Partial<IExpense>) {
    try {
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }

      if (!expense.isRecurring) {
        throw new Error('Not a recurring expense');
      }

      // Update the parent expense
      Object.assign(expense, updates);
      await expense.save();

      // Update future instances if they exist
      if (updates.amount || updates.description || updates.category) {
        await Expense.updateMany(
          {
            parentExpenseId: expense._id,
            date: { $gt: new Date() },
          },
          {
            $set: {
              amount: updates.amount,
              description: updates.description,
              category: updates.category,
            },
          }
        );
      }

      return expense;
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      throw error;
    }
  }

  async deleteRecurringExpense(expenseId: string, deleteAllInstances = false) {
    try {
      const expense = await Expense.findById(expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }

      if (!expense.isRecurring) {
        throw new Error('Not a recurring expense');
      }

      // Delete the parent expense
      await expense.deleteOne();

      // Delete all instances if requested
      if (deleteAllInstances) {
        await Expense.deleteMany({ parentExpenseId: expense._id });
      } else {
        // Only delete future instances
        await Expense.deleteMany({
          parentExpenseId: expense._id,
          date: { $gt: new Date() },
        });
      }
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      throw error;
    }
  }
}

export const recurringExpenseService = new RecurringExpenseService();
