import { Router } from 'express';
import { EmailController, emailValidation } from '@/controllers/EmailController';
import { authenticate, requireMicrosoftConnection, rateLimitPerUser } from '@/middleware/auth';
import { handleValidation, asyncHandler } from '@/middleware';

const router = Router();

/**
 * Email routes
 * All routes require authentication
 */

// Apply authentication to all email routes
router.use(authenticate);

// Account management
router.post(
  '/connect',
  emailValidation.connectAccount,
  handleValidation,
  asyncHandler(EmailController.connectAccount)
);

router.get(
  '/accounts',
  asyncHandler(EmailController.getAccounts)
);

// Email operations (require Microsoft connection)
router.get(
  '/messages',
  requireMicrosoftConnection,
  emailValidation.getMessages,
  handleValidation,
  rateLimitPerUser(100, 60000), // 100 requests per minute
  asyncHandler(EmailController.getMessages)
);

router.get(
  '/messages/:id',
  requireMicrosoftConnection,
  emailValidation.getMessage,
  handleValidation,
  rateLimitPerUser(200, 60000), // 200 requests per minute
  asyncHandler(EmailController.getMessage)
);

router.get(
  '/search',
  requireMicrosoftConnection,
  emailValidation.searchMessages,
  handleValidation,
  rateLimitPerUser(50, 60000), // 50 searches per minute
  asyncHandler(EmailController.searchMessages)
);

router.patch(
  '/messages/:id/read',
  requireMicrosoftConnection,
  emailValidation.updateReadStatus,
  handleValidation,
  rateLimitPerUser(100, 60000), // 100 updates per minute
  asyncHandler(EmailController.updateReadStatus)
);

router.get(
  '/stats',
  requireMicrosoftConnection,
  rateLimitPerUser(10, 60000), // 10 stats requests per minute
  asyncHandler(EmailController.getEmailStats)
);

export default router;