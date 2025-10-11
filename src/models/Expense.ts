import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  category: string;
  date: Date;
  isRecurring: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurringEndDate?: Date;
  parentExpenseId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
      max: [999999.99, 'Amount cannot exceed 999,999.99'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [200, 'Description cannot be more than 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category cannot be more than 50 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: [
        function (this: IExpense) {
          return this.isRecurring;
        },
        'Recurring type is required for recurring expenses',
      ],
    },
    recurringEndDate: {
      type: Date,
      required: [
        function (this: IExpense) {
          return this.isRecurring;
        },
        'End date is required for recurring expenses',
      ],
    },
    parentExpenseId: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient queries
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, createdAt: -1 });
expenseSchema.index({ userId: 1, isRecurring: 1 });
expenseSchema.index({ parentExpenseId: 1 });

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function () {
  return `$${this.amount.toFixed(2)}`;
});

// Ensure virtuals are serialized
expenseSchema.set('toJSON', { virtuals: true });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
