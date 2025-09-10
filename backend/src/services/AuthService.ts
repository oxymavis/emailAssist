import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AuthTokens, MicrosoftTokens, JWTPayload, User } from '@/types';
import config, { MICROSOFT_CONFIG, CACHE_KEYS, CACHE_TTL } from '@/config';
import redis from '@/config/redis';
import { UserModel } from '@/models/User';
import logger from '@/utils/logger';
import {
  AuthenticationError,
  MicrosoftAuthError,
  TokenExpiredError,
  InvalidTokenError,
  ERROR_MESSAGES
} from '@/utils/errors';

/**
 * Authentication service
 * Handles JWT tokens, Microsoft OAuth2, and user sessions
 */
export class AuthService {
  /**
   * Generate JWT access and refresh tokens for user
   */
  static async generateTokens(user: User): Promise<AuthTokens> {
    try {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = jwt.sign(payload, config.env.JWT_SECRET as string, {
        expiresIn: config.env.JWT_EXPIRES_IN,
        issuer: 'email-assist',
        audience: 'email-assist-client'
      } as jwt.SignOptions);

      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.env.REFRESH_TOKEN_SECRET as string,
        {
          expiresIn: config.env.REFRESH_TOKEN_EXPIRES_IN,
          issuer: 'email-assist'
        } as jwt.SignOptions
      );

      // Store refresh token in Redis
      await redis.set(
        CACHE_KEYS.USER_SESSION(user.id),
        JSON.stringify({
          refreshToken,
          userId: user.id,
          email: user.email,
          createdAt: new Date().toISOString()
        }),
        CACHE_TTL.SESSION
      );

      logger.info('Tokens generated successfully', { userId: user.id });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.parseTimeToSeconds(config.env.JWT_EXPIRES_IN)
      };
    } catch (error) {
      logger.error('Failed to generate tokens', { userId: user.id, error });
      throw new AuthenticationError('Failed to generate authentication tokens');
    }
  }

  /**
   * Verify and decode JWT token
   */
  static async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, config.env.JWT_SECRET as string, {
        issuer: 'email-assist',
        audience: 'email-assist-client'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if ((error as any).name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.env.REFRESH_TOKEN_SECRET as string) as any;
      
      if (decoded.type !== 'refresh') {
        throw new InvalidTokenError('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const sessionData = await redis.getJson(CACHE_KEYS.USER_SESSION(decoded.userId)) as any;
      if (!sessionData || sessionData.refreshToken !== refreshToken) {
        throw new InvalidTokenError('Refresh token not found or invalid');
      }

      // Get user data
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);
      
      logger.info('Token refreshed successfully', { userId: user.id });
      return tokens;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof InvalidTokenError) {
        throw error;
      }
      
      if ((error as any).name === 'TokenExpiredError') {
        throw new TokenExpiredError('Refresh token has expired');
      }
      
      throw new InvalidTokenError('Invalid refresh token');
    }
  }

  /**
   * Revoke user session (logout)
   */
  static async revokeSession(userId: string): Promise<void> {
    try {
      await redis.delete(CACHE_KEYS.USER_SESSION(userId));
      logger.info('User session revoked', { userId });
    } catch (error) {
      logger.error('Failed to revoke session', { userId, error });
    }
  }

  /**
   * Get Microsoft OAuth2 authorization URL
   */
  static getMicrosoftAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: config.env.MICROSOFT_REDIRECT_URI,
      scope: config.env.MICROSOFT_GRAPH_SCOPE,
      response_mode: 'query'
    });

    if (state) {
      params.append('state', state);
    }

    return `${MICROSOFT_CONFIG.AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange Microsoft authorization code for tokens
   */
  static async exchangeMicrosoftCode(code: string): Promise<MicrosoftTokens> {
    try {
      const tokenParams = new URLSearchParams({
        client_id: config.env.MICROSOFT_CLIENT_ID,
        client_secret: config.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: config.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: config.env.MICROSOFT_GRAPH_SCOPE
      });

      const response = await axios.post(
        MICROSOFT_CONFIG.TOKEN_ENDPOINT,
        tokenParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      if (!response.data.access_token) {
        throw new MicrosoftAuthError('No access token received from Microsoft');
      }

      logger.info('Microsoft tokens exchanged successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to exchange Microsoft code', error);
      
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error_description || 'Microsoft authentication failed';
        throw new MicrosoftAuthError(message);
      }
      
      throw new MicrosoftAuthError('Failed to authenticate with Microsoft');
    }
  }

  /**
   * Refresh Microsoft access token
   */
  static async refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftTokens> {
    try {
      const tokenParams = new URLSearchParams({
        client_id: config.env.MICROSOFT_CLIENT_ID,
        client_secret: config.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: config.env.MICROSOFT_GRAPH_SCOPE
      });

      const response = await axios.post(
        MICROSOFT_CONFIG.TOKEN_ENDPOINT,
        tokenParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

      logger.info('Microsoft token refreshed successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to refresh Microsoft token', error);
      throw new MicrosoftAuthError('Failed to refresh Microsoft token');
    }
  }

  /**
   * Get user's valid Microsoft access token (refresh if needed)
   */
  static async getValidMicrosoftToken(userId: string): Promise<string> {
    try {
      const tokens = await UserModel.getMicrosoftTokens(userId);
      
      if (!tokens) {
        throw new MicrosoftAuthError('Microsoft account not connected');
      }

      // Check if token is expired (with 5 minute buffer)
      const now = new Date();
      const expiryBuffer = new Date(tokens.expiresAt.getTime() - 5 * 60 * 1000);
      
      if (now >= expiryBuffer) {
        logger.info('Microsoft token expired, refreshing', { userId });
        
        // Refresh the token
        const newTokens = await this.refreshMicrosoftToken(tokens.refreshToken);
        
        // Update stored tokens
        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
        await UserModel.updateMicrosoftTokens(userId, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || tokens.refreshToken,
          expiresAt
        });

        return newTokens.access_token;
      }

      return tokens.accessToken;
    } catch (error) {
      logger.error('Failed to get valid Microsoft token', { userId, error });
      throw new MicrosoftAuthError('Failed to get valid Microsoft access token');
    }
  }

  /**
   * Validate user session
   */
  static async validateSession(userId: string): Promise<boolean> {
    try {
      const sessionData = await redis.getJson(CACHE_KEYS.USER_SESSION(userId));
      return sessionData !== null;
    } catch (error) {
      logger.error('Failed to validate session', { userId, error });
      return false;
    }
  }

  /**
   * Helper function to parse time string to seconds
   */
  private static parseTimeToSeconds(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1), 10);

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 3600; // Default to 1 hour
    }
  }
}