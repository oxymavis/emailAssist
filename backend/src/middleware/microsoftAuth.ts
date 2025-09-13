/**
 * Microsoft Graph API Authentication Middleware
 * Handles Microsoft OAuth token validation and refresh
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { MicrosoftAuthToken } from '@/models/MicrosoftAuthToken';
import { ResponseHandler } from '@/utils/response';
import logger from '@/utils/logger';
import { AuthenticationError, InvalidTokenError } from '@/utils/errors';

export interface MicrosoftAuthRequest extends Request {
  microsoftTokens?: MicrosoftAuthToken;
  microsoftAuth?: {
    accessToken: string;
    email: string;
    userId: string;
  };
}

/**
 * Microsoft Graph API authentication middleware
 * Validates and refreshes Microsoft OAuth tokens
 */
export const requireMicrosoftAuth = async (
  req: MicrosoftAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First, check if user is authenticated with our system
    if (!req.user) {
      throw new AuthenticationError('User authentication required');
    }

    // Get Microsoft tokens for the user
    const tokens = await MicrosoftAuthToken.findByUserId(req.user.id);
    
    if (!tokens) {
      ResponseHandler.authorizationError(
        res,
        'Microsoft account not connected. Please connect your Microsoft account first.'
      );
      return;
    }

    // Check if access token is still valid (with 5 minute buffer)
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    let validAccessToken = tokens.accessToken;
    
    if (tokens.expiresAt.getTime() - now.getTime() <= bufferTime) {
      // Token is expired or about to expire, refresh it
      if (!tokens.refreshToken) {
        ResponseHandler.authorizationError(
          res,
          'Microsoft access token expired and no refresh token available. Please reconnect your Microsoft account.'
        );
        return;
      }

      try {
        logger.info('Refreshing Microsoft access token', { 
          userId: req.user.id,
          email: tokens.email 
        });
        
        const newTokens = await refreshMicrosoftTokens(tokens.refreshToken);
        
        // Update tokens in database
        await MicrosoftAuthToken.updateTokens(
          req.user.id,
          newTokens.accessToken,
          newTokens.refreshToken,
          newTokens.expiresIn
        );
        
        validAccessToken = newTokens.accessToken;
        
        logger.info('Microsoft access token refreshed successfully', { 
          userId: req.user.id,
          email: tokens.email 
        });
      } catch (refreshError) {
        logger.error('Failed to refresh Microsoft access token', { 
          userId: req.user.id,
          email: tokens.email,
          error: refreshError
        });
        
        ResponseHandler.authorizationError(
          res,
          'Failed to refresh Microsoft access token. Please reconnect your Microsoft account.'
        );
        return;
      }
    }

    // Validate the access token by making a test call to Microsoft Graph
    try {
      await validateMicrosoftToken(validAccessToken);
    } catch (validationError) {
      logger.error('Microsoft access token validation failed', { 
        userId: req.user.id,
        email: tokens.email,
        error: validationError
      });
      
      ResponseHandler.authorizationError(
        res,
        'Microsoft access token is invalid. Please reconnect your Microsoft account.'
      );
      return;
    }

    // Attach Microsoft auth info to request
    req.microsoftTokens = tokens;
    req.microsoftAuth = {
      accessToken: validAccessToken,
      email: tokens.email,
      userId: req.user.id
    };

    logger.debug('Microsoft authentication successful', { 
      userId: req.user.id,
      email: tokens.email,
      requestId: req.requestId 
    });

    next();
  } catch (error) {
    logger.error('Microsoft authentication middleware error', { 
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    });

    if (error instanceof AuthenticationError) {
      ResponseHandler.authError(res, error.message);
      return;
    }

    ResponseHandler.authError(res, 'Microsoft authentication failed');
  }
};

/**
 * Optional Microsoft authentication middleware
 * Loads Microsoft auth if available, but doesn't require it
 */
export const optionalMicrosoftAuth = async (
  req: MicrosoftAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const tokens = await MicrosoftAuthToken.findByUserId(req.user.id);
    
    if (!tokens) {
      next();
      return;
    }

    // Check if access token is still valid
    const now = new Date();
    const bufferTime = 5 * 60 * 1000;
    
    if (tokens.expiresAt.getTime() - now.getTime() > bufferTime) {
      // Token is still valid, attach to request
      req.microsoftTokens = tokens;
      req.microsoftAuth = {
        accessToken: tokens.accessToken,
        email: tokens.email,
        userId: req.user.id
      };
    }

    next();
  } catch (error) {
    // Continue without Microsoft auth for optional middleware
    logger.debug('Optional Microsoft authentication failed', { 
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId 
    });
    
    next();
  }
};

/**
 * Refresh Microsoft OAuth tokens
 */
async function refreshMicrosoftTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: process.env.MICROSOFT_GRAPH_SCOPE || 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read'
  });

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 30000
  });

  if (!response.data.access_token) {
    throw new Error('No access token in refresh response');
  }

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: response.data.expires_in || 3600
  };
}

/**
 * Validate Microsoft access token by making a test call to Graph API
 */
async function validateMicrosoftToken(accessToken: string): Promise<void> {
  try {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.status !== 200) {
      throw new Error(`Graph API returned status ${response.status}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new InvalidTokenError('Microsoft access token is invalid or expired');
      }
      throw new Error(`Graph API validation failed: ${error.response?.status || 'Network error'}`);
    }
    throw error;
  }
}

/**
 * Get Microsoft Graph API client with authentication headers
 */
export function createMicrosoftGraphClient(accessToken: string) {
  return axios.create({
    baseURL: 'https://graph.microsoft.com/v1.0',
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Type extension for Express Request
 */
declare global {
  namespace Express {
    interface Request {
      microsoftTokens?: MicrosoftAuthToken;
      microsoftAuth?: {
        accessToken: string;
        email: string;
        userId: string;
      };
    }
  }
}

export default {
  requireMicrosoftAuth,
  optionalMicrosoftAuth,
  createMicrosoftGraphClient
};