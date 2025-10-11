import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  userId?: mongoose.Types.ObjectId; // Optional for default categories
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryModel extends Model<ICategory> {
  getDefaultCategories(): Array<{
    name: string;
    color: string;
    icon: string;
    isDefault: boolean;
  }>;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [50, 'Category name cannot be more than 50 characters'],
    },
    color: {
      type: String,
      required: [true, 'Color is required'],
      default: '#3B82F6', // Blue
      match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'],
    },
    icon: {
      type: String,
      required: [true, 'Icon is required'],
      default: '💰',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return !this.isDefault; // Required only for non-default categories
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
categorySchema.index({ userId: 1, name: 1 }, { unique: true, sparse: true });
categorySchema.index({ isDefault: 1 });

// Static method to get default categories
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
    { name: 'Other', color: '#9CA3AF', icon: '📦', isDefault: true },
  ];
};

export const Category = mongoose.model<ICategory, CategoryModel>(
  'Category',
  categorySchema
);
