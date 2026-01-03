import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { syncLimiter } from '../middleware/rateLimiter';
import { syncController } from './sync.controller';
import { validateSyncRequest } from './sync.validation';

const router = Router();

router.post(
  '/',
  syncLimiter,
  authenticate,
  validateSyncRequest,
  (req, res) => syncController.sync(req, res)
);

export default router;
