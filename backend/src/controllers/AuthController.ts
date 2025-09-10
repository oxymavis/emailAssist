import { Request, Response } from 'express';
import { body } from 'express-validator';
import { AuthService } from '@/services/AuthService';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { UserModel } from '@/models/User';
import { ResponseHandler } from '@/utils/response';
import logger from '@/utils/logger';
import {
  ValidationError,
  AuthenticationError,
  MicrosoftAuthError,
  ConflictError,
  ERROR_MESSAGES
} from '@/utils/errors';

/**
 * Authentication controller
 * Handles user authentication, registration, and Microsoft OAuth2 flow
 */
export class AuthController {
  /**
   * Get Microsoft OAuth2 authorization URL
   * GET /api/auth/microsoft
   */
  static async getMicrosoftAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const state = req.query.state as string;
      const authUrl = AuthService.getMicrosoftAuthUrl(state);
      
      logger.info('Microsoft auth URL generated', { 
        state,
        requestId: req.requestId 
      });

      ResponseHandler.success(res, {
        authUrl,
        state
      }, 'Microsoft authorization URL generated successfully');
    } catch (error) {
      logger.error('Failed to generate Microsoft auth URL', { 
        error,
        requestId: req.requestId 
      });
      
      ResponseHandler.error(
        res,
        'Failed to generate authorization URL',
        500,
        'MICROSOFT_AUTH_ERROR'
      );
    }
  }

  /**
   * Handle Microsoft OAuth2 callback
   * POST /api/auth/microsoft
   */
  static async handleMicrosoftCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.body;

      if (!code) {
        throw new ValidationError('Authorization code is required');
      }

      // Exchange code for tokens
      const microsoftTokens = await AuthService.exchangeMicrosoftCode(code);
      
      // Get user profile from Microsoft Graph
      const tempGraphService = new MicrosoftGraphService('temp');
      // Temporarily set the access token for profile retrieval
      const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/me`, {
        headers: {
          'Authorization': `Bearer ${microsoftTokens.access_token}`
        }
      });
      
      if (!graphResponse.ok) {
        throw new MicrosoftAuthError('Failed to get user profile from Microsoft');
      }
      
      const userProfile = await graphResponse.json() as {
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
        givenName?: string;
        id?: string;
      };

      // Validate required email
      const email = userProfile.mail || userProfile.userPrincipalName;
      if (!email) {
        throw new MicrosoftAuthError('Unable to retrieve email from Microsoft profile');
      }

      // Check if user already exists
      let user = await UserModel.findByEmail(email);
      
      if (!user) {
        // Create new user
        user = await UserModel.create({
          email: email,
          name: userProfile.displayName || userProfile.givenName || 'User'
        });
      }

      // Store Microsoft tokens
      const expiresAt = new Date(Date.now() + microsoftTokens.expires_in * 1000);
      await UserModel.updateMicrosoftTokens(user.id, {
        accessToken: microsoftTokens.access_token,
        refreshToken: microsoftTokens.refresh_token,
        expiresAt
      });

      // Generate our JWT tokens
      const tokens = await AuthService.generateTokens(user);

      logger.info('Microsoft authentication successful', { 
        userId: user.id,
        email: user.email,
        requestId: req.requestId 
      });

      ResponseHandler.success(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          settings: user.settings
        },
        tokens
      }, 'Authentication successful');
    } catch (error) {
      logger.error('Microsoft authentication failed', { 
        error,
        requestId: req.requestId 
      });

      if (error instanceof ValidationError) {
        ResponseHandler.validationError(res, [{ 
          field: 'code', 
          message: error.message 
        }]);
        return;
      }

      if (error instanceof MicrosoftAuthError) {
        ResponseHandler.error(
          res,
          error.message,
          401,
          'MICROSOFT_AUTH_ERROR'
        );
        return;
      }

      ResponseHandler.error(
        res,
        'Authentication failed',
        500,
        'AUTHENTICATION_ERROR'
      );
    }
  }

  /**
   * Refresh JWT token
   * POST /api/auth/refresh
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
      }

      const tokens = await AuthService.refreshToken(refreshToken);

      logger.info('Token refreshed successfully', { 
        requestId: req.requestId 
      });

      ResponseHandler.success(res, { tokens }, 'Token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh failed', { 
        error,
        requestId: req.requestId 
      });

      if (error instanceof ValidationError) {
        ResponseHandler.validationError(res, [{ 
          field: 'refreshToken', 
          message: error.message 
        }]);
        return;
      }

      ResponseHandler.authError(res, 'Token refresh failed');
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      ResponseHandler.success(res, {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        settings: user.settings,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }, 'Profile retrieved successfully');
    } catch (error) {
      logger.error('Failed to get profile', { 
        userId: req.user?.id,
        error,
        requestId: req.requestId 
      });

      ResponseHandler.error(
        res,
        'Failed to retrieve profile',
        500,
        'PROFILE_ERROR'
      );
    }
  }

  /**
   * Update user profile
   * PUT /api/auth/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const updateData = req.body;

      const updatedUser = await UserModel.update(user.id, updateData);

      logger.info('Profile updated successfully', { 
        userId: user.id,
        requestId: req.requestId 
      });

      ResponseHandler.success(res, {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        settings: updatedUser.settings,
        updatedAt: updatedUser.updatedAt
      }, 'Profile updated successfully');
    } catch (error) {
      logger.error('Failed to update profile', { 
        userId: req.user?.id,
        error,
        requestId: req.requestId 
      });

      ResponseHandler.error(
        res,
        'Failed to update profile',
        500,
        'PROFILE_UPDATE_ERROR'
      );
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      await AuthService.revokeSession(user.id);

      logger.info('User logged out successfully', { 
        userId: user.id,
        requestId: req.requestId 
      });

      ResponseHandler.success(res, null, 'Logged out successfully');
    } catch (error) {
      logger.error('Failed to logout', { 
        userId: req.user?.id,
        error,
        requestId: req.requestId 
      });

      ResponseHandler.error(
        res,
        'Failed to logout',
        500,
        'LOGOUT_ERROR'
      );
    }
  }

  /**
   * Check authentication status
   * GET /api/auth/status
   */
  static async checkStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        ResponseHandler.success(res, {
          authenticated: false
        }, 'Not authenticated');
        return;
      }

      // Check Microsoft connection status
      const microsoftTokens = await UserModel.getMicrosoftTokens(user.id);
      const hasMicrosoftConnection = !!microsoftTokens;

      ResponseHandler.success(res, {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role
        },
        connections: {
          microsoft: hasMicrosoftConnection
        }
      }, 'Authentication status retrieved');
    } catch (error) {
      logger.error('Failed to check auth status', { 
        userId: req.user?.id,
        error,
        requestId: req.requestId 
      });

      ResponseHandler.error(
        res,
        'Failed to check authentication status',
        500,
        'AUTH_STATUS_ERROR'
      );
    }
  }

  /**
   * Delete user account
   * DELETE /api/auth/account
   */
  static async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Revoke session first
      await AuthService.revokeSession(user.id);

      // Delete user account
      await UserModel.delete(user.id);

      logger.info('User account deleted successfully', { 
        userId: user.id,
        requestId: req.requestId 
      });

      ResponseHandler.success(res, null, 'Account deleted successfully');
    } catch (error) {
      logger.error('Failed to delete account', { 
        userId: req.user?.id,
        error,
        requestId: req.requestId 
      });

      ResponseHandler.error(
        res,
        'Failed to delete account',
        500,
        'ACCOUNT_DELETE_ERROR'
      );
    }
  }
}

/**
 * Validation rules for auth endpoints
 */
export const authValidation = {
  microsoftCallback: [
    body('code')
      .notEmpty()
      .withMessage('Authorization code is required')
      .isString()
      .withMessage('Authorization code must be a string')
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isString()
      .withMessage('Refresh token must be a string')
  ],

  updateProfile: [
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be between 1 and 255 characters'),
    
    body('avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL'),

    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),

    body('settings.language')
      .optional()
      .isIn(['zh-CN', 'en-US'])
      .withMessage('Language must be zh-CN or en-US'),

    body('settings.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Theme must be light, dark, or auto'),

    body('settings.notifications')
      .optional()
      .isObject()
      .withMessage('Notifications settings must be an object'),

    body('settings.analysis')
      .optional()
      .isObject()
      .withMessage('Analysis settings must be an object')
  ]
};