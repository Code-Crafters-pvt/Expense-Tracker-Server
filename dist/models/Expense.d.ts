import mongoose, { Document } from 'mongoose';
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
export declare const Expense: mongoose.Model<IExpense, {}, {}, {}, mongoose.Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Expense.d.ts.map