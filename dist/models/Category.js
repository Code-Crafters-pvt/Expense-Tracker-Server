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
exports.Category = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const categorySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        maxlength: [50, 'Category name cannot be more than 50 characters']
    },
    color: {
        type: String,
        required: [true, 'Color is required'],
        default: '#3B82F6',
        match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color']
    },
    icon: {
        type: String,
        required: [true, 'Icon is required'],
        default: '💰'
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return !this.isDefault;
        }
    }
}, {
    timestamps: true
});
categorySchema.index({ userId: 1, name: 1 }, { unique: true, sparse: true });
categorySchema.index({ isDefault: 1 });
categorySchema.statics.getDefaultCategories = function () {
    return [
        { name: 'Food & Dining', color: '#EF4444', icon: '🍕', isDefault: true },
        { name: 'Transportation', color: '#3B82F6', icon: '🚗', isDefault: true },
        { name: 'Shopping', color: '#8B5CF6', icon: '🛍️', isDefault: true },
        { name: 'Entertainment', color: '#F59E0B', icon: '🎬', isDefault: true },
        { name: 'Healthcare', color: '#10B981', icon: '🏥', isDefault: true },
        { name: 'Utilities', color: '#6B7280', icon: '⚡', isDefault: true },
        { name: 'Housing', color: '#84CC16', icon: '🏠', isDefault: true },
        { name: 'Education', color: '#06B6D4', icon: '📚', isDefault: true },
        { name: 'Travel', color: '#F97316', icon: '✈️', isDefault: true },
        { name: 'Other', color: '#9CA3AF', icon: '📦', isDefault: true }
    ];
};
exports.Category = mongoose_1.default.model('Category', categorySchema);
//# sourceMappingURL=Category.js.map