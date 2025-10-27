import express from 'express';
import { query, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { exportService } from '../services/exportService';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Export expenses
router.get(
  '/',
  [
    query('format')
      .isIn(['csv', 'excel'])
      .withMessage('Format must be either csv or excel'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('category')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Category must be between 1 and 50 characters'),
  ],
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const format = req.query.format as 'csv' | 'excel';
      const options = {
        format,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        category: req.query.category as string | undefined,
      };

      const { data, filename } = await exportService.exportExpenses(
        req.user._id.toString(),
        options
      );

      // Set response headers
      res.setHeader(
        'Content-Type',
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.setHeader('Content-Length', data.length);

      // Send file
      res.send(data);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error while exporting expenses',
      });
    }
  }
);

export default router;
