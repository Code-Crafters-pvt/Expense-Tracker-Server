interface ExportOptions {
    format: 'csv' | 'excel';
    startDate?: Date;
    endDate?: Date;
    category?: string;
}
declare class ExportService {
    private formatExpenseForExport;
    exportExpenses(userId: string, options: ExportOptions): Promise<{
        data: any;
        filename: string;
    }>;
    private generateCSV;
    private generateExcel;
}
export declare const exportService: ExportService;
export {};
//# sourceMappingURL=exportService.d.ts.map