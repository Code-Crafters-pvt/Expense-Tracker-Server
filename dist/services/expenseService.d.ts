import { IExpense } from '../models/Expense';
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
declare class ExpenseService {
    createExpense(userId: string, expenseData: Partial<IExpense>): Promise<import("mongoose").Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    getExpenses(userId: string, filters?: ExpenseFilters, pagination?: PaginationOptions): Promise<{
        expenses: (import("mongoose").Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
            _id: unknown;
        }> & {
            __v: number;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getExpense(userId: string, expenseId: string): Promise<import("mongoose").Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    updateExpense(userId: string, expenseId: string, updates: Partial<IExpense>): Promise<import("mongoose").Document<unknown, {}, IExpense, {}, {}> & IExpense & Required<{
        _id: unknown;
    }> & {
        __v: number;
    }>;
    deleteExpense(userId: string, expenseId: string, deleteAllInstances?: boolean): Promise<void>;
    getMonthlyTotal(userId: string, date?: Date): Promise<any>;
    getCategoryTotals(userId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
}
export declare const expenseService: ExpenseService;
export {};
//# sourceMappingURL=expenseService.d.ts.map