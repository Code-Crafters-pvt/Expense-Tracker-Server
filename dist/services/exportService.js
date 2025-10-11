"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = void 0;
const Expense_1 = require("../models/Expense");
const json2csv_1 = require("json2csv");
const exceljs_1 = __importDefault(require("exceljs"));
const buffer_1 = require("buffer");
class ExportService {
    formatExpenseForExport(expense) {
        return {
            'Date': new Date(expense.date).toLocaleDateString(),
            'Amount': expense.amount.toFixed(2),
            'Description': expense.description,
            'Category': expense.category,
            'Type': expense.isRecurring ? 'Recurring' : 'One-time',
            'Created At': new Date(expense.createdAt).toLocaleDateString(),
        };
    }
    async exportExpenses(userId, options) {
        try {
            const query = { userId };
            if (options.startDate || options.endDate) {
                query.date = {};
                if (options.startDate)
                    query.date.$gte = options.startDate;
                if (options.endDate)
                    query.date.$lte = options.endDate;
            }
            if (options.category) {
                query.category = options.category;
            }
            const expenses = await Expense_1.Expense.find(query).sort({ date: -1 });
            const formattedExpenses = expenses.map(expense => this.formatExpenseForExport(expense));
            if (options.format === 'csv') {
                return this.generateCSV(formattedExpenses);
            }
            else {
                return this.generateExcel(formattedExpenses);
            }
        }
        catch (error) {
            console.error('Error exporting expenses:', error);
            throw error;
        }
    }
    async generateCSV(expenses) {
        try {
            const fields = ['Date', 'Amount', 'Description', 'Category', 'Type', 'Created At'];
            const parser = new json2csv_1.Parser({ fields });
            const csv = parser.parse(expenses);
            return {
                data: buffer_1.Buffer.from(csv),
                filename: `expenses_${new Date().toISOString().split('T')[0]}.csv`,
            };
        }
        catch (error) {
            console.error('Error generating CSV:', error);
            throw error;
        }
    }
    async generateExcel(expenses) {
        try {
            const workbook = new exceljs_1.default.Workbook();
            const worksheet = workbook.addWorksheet('Expenses');
            worksheet.columns = [
                { header: 'Date', key: 'Date', width: 15 },
                { header: 'Amount', key: 'Amount', width: 15 },
                { header: 'Description', key: 'Description', width: 40 },
                { header: 'Category', key: 'Category', width: 15 },
                { header: 'Type', key: 'Type', width: 15 },
                { header: 'Created At', key: 'Created At', width: 15 },
            ];
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' },
            };
            worksheet.addRows(expenses);
            const amountColumn = worksheet.getColumn('Amount');
            amountColumn.numFmt = '"$"#,##0.00';
            const buffer = await workbook.xlsx.writeBuffer();
            return {
                data: buffer,
                filename: `expenses_${new Date().toISOString().split('T')[0]}.xlsx`,
            };
        }
        catch (error) {
            console.error('Error generating Excel:', error);
            throw error;
        }
    }
}
exports.exportService = new ExportService();
//# sourceMappingURL=exportService.js.map