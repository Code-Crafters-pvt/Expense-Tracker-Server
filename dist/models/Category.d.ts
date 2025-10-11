import mongoose, { Document, Model } from 'mongoose';
export interface ICategory extends Document {
    name: string;
    color: string;
    icon: string;
    isDefault: boolean;
    userId?: mongoose.Types.ObjectId;
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
export declare const Category: CategoryModel;
export {};
//# sourceMappingURL=Category.d.ts.map