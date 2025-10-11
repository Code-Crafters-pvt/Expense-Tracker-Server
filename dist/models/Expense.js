"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const expenseSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0'],
        max: [999999.99, 'Amount cannot exceed 999,999.99']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [200, 'Description cannot be more than 200 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true,
        maxlength: [50, 'Category cannot be more than 50 characters']
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
        default: Date.now
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringType: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        required: [
            function () {
                return this.isRecurring;
            },
            'Recurring type is required for recurring expenses'
        ]
    },
    recurringEndDate: {
        type: Date,
        required: [
            function () {
                return this.isRecurring;
            },
            'End date is required for recurring expenses'
        ]
    },
    parentExpenseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Expense'
    }
}, {
    timestamps: true
});
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });
expenseSchema.index({ userId: 1, createdAt: -1 });
expenseSchema.index({ userId: 1, isRecurring: 1 });
expenseSchema.index({ parentExpenseId: 1 });
expenseSchema.virtual('formattedAmount').get(function () {
    return `$${this.amount.toFixed(2)}`;
});
expenseSchema.set('toJSON', { virtuals: true });
exports.Expense = mongoose_1.default.model('Expense', expenseSchema);
//# sourceMappingURL=Expense.js.map