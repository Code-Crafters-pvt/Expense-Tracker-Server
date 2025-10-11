"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const exportService_1 = require("../services/exportService");
const router = express_1.default.Router();
router.use(auth_1.authenticate);
router.get('/', [
    (0, express_validator_1.query)('format')
        .isIn(['csv', 'excel'])
        .withMessage('Format must be either csv or excel'),
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('category')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Category must be between 1 and 50 characters'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        const format = req.query.format;
        const options = {
            format,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            category: req.query.category,
        };
        const { data, filename } = await exportService_1.exportService.exportExpenses(req.user._id, options);
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', data.length);
        res.send(data);
    }
    catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while exporting expenses'
        });
    }
});
exports.default = router;
//# sourceMappingURL=export.js.map