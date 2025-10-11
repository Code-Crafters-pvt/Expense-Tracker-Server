"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Category_1 = require("../models/Category");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
const validateCategory = [
    (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Category name must be between 1 and 50 characters'),
    (0, express_validator_1.body)('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('Color must be a valid hex color'),
    (0, express_validator_1.body)('icon')
        .optional()
        .trim()
        .isLength({ min: 1, max: 10 })
        .withMessage('Icon must be between 1 and 10 characters')
];
router.get('/', async (req, res) => {
    try {
        const defaultCategories = await Category_1.Category.find({ isDefault: true });
        const userCategories = await Category_1.Category.find({
            userId: req.user._id,
            isDefault: false
        });
        const categories = [...defaultCategories, ...userCategories];
        res.json({
            success: true,
            data: { categories }
        });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while fetching categories'
        });
    }
});
router.post('/', validateCategory, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { name, color, icon } = req.body;
        const existingCategory = await Category_1.Category.findOne({
            name: name.toLowerCase(),
            userId: req.user._id
        });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                error: 'Category with this name already exists'
            });
        }
        const category = new Category_1.Category({
            name: name.toLowerCase(),
            color: color || '#3B82F6',
            icon: icon || '💰',
            userId: req.user._id,
            isDefault: false
        });
        await category.save();
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: { category }
        });
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while creating category'
        });
    }
});
router.put('/:id', validateCategory, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const { name, color, icon } = req.body;
        const category = await Category_1.Category.findOneAndUpdate({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: false
        }, {
            name: name.toLowerCase(),
            color: color || '#3B82F6',
            icon: icon || '💰'
        }, { new: true, runValidators: true });
        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Category not found or cannot be updated'
            });
        }
        res.json({
            success: true,
            message: 'Category updated successfully',
            data: { category }
        });
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while updating category'
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const category = await Category_1.Category.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: false
        });
        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Category not found or cannot be deleted'
            });
        }
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while deleting category'
        });
    }
});
router.post('/init-defaults', async (req, res) => {
    try {
        const existingDefaults = await Category_1.Category.find({ isDefault: true });
        if (existingDefaults.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Default categories already exist'
            });
        }
        const defaultCategories = Category_1.Category.getDefaultCategories();
        const categories = await Category_1.Category.insertMany(defaultCategories);
        res.status(201).json({
            success: true,
            message: 'Default categories initialized successfully',
            data: { categories }
        });
    }
    catch (error) {
        console.error('Init defaults error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while initializing default categories'
        });
    }
});
exports.default = router;
//# sourceMappingURL=categories.js.map