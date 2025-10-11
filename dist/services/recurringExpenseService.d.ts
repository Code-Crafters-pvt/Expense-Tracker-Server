import { IExpense } from '../models/Expense';
declare class RecurringExpenseService {
    generateRecurringExpenses(userId: string, startDate: Date, endDate: Date): Promise<IExpense[]>;
    updateRecurringExpense(expenseId: string, updates: Partial<IExpense>): Promise<import("mongoose").Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteRecurringExpense(expenseId: string, deleteAllInstances?: boolean): Promise<void>;
}
export declare const recurringExpenseService: RecurringExpenseService;
export {};
//# sourceMappingURL=recurringExpenseService.d.ts.map