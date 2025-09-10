import { Router } from 'express';
import { AuthController, authValidation } from '@/controllers/AuthController';
import { authenticate, optionalAuth } from '@/middleware/auth';
import { handleValidation, asyncHandler } from '@/middleware';

const router = Router();

/**
 * Authentication routes
 */

// Microsoft OAuth2 flow
router.get(
  '/microsoft',
  asyncHandler(AuthController.getMicrosoftAuthUrl)
);

router.post(
  '/microsoft',
  authValidation.microsoftCallback,
  handleValidation,
  asyncHandler(AuthController.handleMicrosoftCallback)
);

// Token management
router.post(
  '/refresh',
  authValidation.refreshToken,
  handleValidation,
  asyncHandler(AuthController.refreshToken)
);

// User profile management
router.get(
  '/profile',
  authenticate,
  asyncHandler(AuthController.getProfile)
);

router.put(
  '/profile',
  authenticate,
  authValidation.updateProfile,
  handleValidation,
  asyncHandler(AuthController.updateProfile)
);

// Session management
router.post(
  '/logout',
  authenticate,
  asyncHandler(AuthController.logout)
);

router.get(
  '/status',
  optionalAuth,
  asyncHandler(AuthController.checkStatus)
);

// Account management
router.delete(
  '/account',
  authenticate,
  asyncHandler(AuthController.deleteAccount)
);

export default router;