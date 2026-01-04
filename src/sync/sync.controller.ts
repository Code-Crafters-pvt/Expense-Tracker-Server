import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { syncService } from './sync.service';
import { SyncRequest } from './types/sync.types';

export class SyncController {
  async sync(req: AuthRequest, res: Response): Promise<Response> {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    try {
      const syncRequest: SyncRequest = {
        lastPulledAt: req.body.lastPulledAt ?? null,
        changes: req.body.changes ?? {},
      };

      const response = await syncService.sync(req.user._id, syncRequest);

      return res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('Sync error:', error);

      if (error instanceof SyncError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'An error occurred during sync. Please try again.',
        code: 'SYNC_ERROR',
      });
    }
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'SYNC_ERROR'
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export const syncController = new SyncController();
