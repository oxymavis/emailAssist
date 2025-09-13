/**
 * Microsoft Auth Token Model
 * Manages Microsoft OAuth tokens for email accounts
 */

import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger from '@/utils/logger';
import { DatabaseError, NotFoundError } from '@/utils/errors';

export interface MicrosoftTokenData {
  id?: string;
  userId: string;
  microsoftId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
}

export class MicrosoftAuthToken {
  id: string;
  userId: string;
  microsoftId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: MicrosoftTokenData) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.microsoftId = data.microsoftId;
    this.email = data.email;
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.expiresAt = data.expiresAt;
    this.scope = data.scope;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Create or update Microsoft auth tokens
   */
  static async upsert(tokenData: MicrosoftTokenData): Promise<MicrosoftAuthToken> {
    try {
      const token = new MicrosoftAuthToken(tokenData);
      
      const query = `
        INSERT INTO microsoft_auth_tokens (
          id, user_id, microsoft_id, email, access_token,
          refresh_token, expires_at, scope, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) 
        DO UPDATE SET
          microsoft_id = EXCLUDED.microsoft_id,
          email = EXCLUDED.email,
          access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, microsoft_auth_tokens.refresh_token),
          expires_at = EXCLUDED.expires_at,
          scope = EXCLUDED.scope,
          updated_at = NOW()
        RETURNING *
      `;

      const values = [
        token.id,
        token.userId,
        token.microsoftId,
        token.email.toLowerCase(),
        token.accessToken,
        token.refreshToken,
        token.expiresAt,
        token.scope,
        token.createdAt,
        token.updatedAt
      ];

      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to save Microsoft auth tokens');
      }

      logger.info('Microsoft auth tokens saved successfully', { 
        userId: token.userId,
        email: token.email 
      });
      
      return this.mapRowToToken(result.rows[0]);
    } catch (error) {
      logger.error('Failed to save Microsoft auth tokens', error);
      throw new DatabaseError('Failed to save Microsoft auth tokens');
    }
  }

  /**
   * Find tokens by user ID
   */
  static async findByUserId(userId: string): Promise<MicrosoftAuthToken | null> {
    try {
      const query = `
        SELECT * FROM microsoft_auth_tokens
        WHERE user_id = $1
      `;

      const result = await database.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToToken(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find Microsoft tokens by user ID', { userId, error });
      throw new DatabaseError('Failed to find Microsoft tokens');
    }
  }

  /**
   * Find tokens by email
   */
  static async findByEmail(email: string): Promise<MicrosoftAuthToken | null> {
    try {
      const query = `
        SELECT * FROM microsoft_auth_tokens
        WHERE email = $1
      `;

      const result = await database.query(query, [email.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToToken(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find Microsoft tokens by email', { email, error });
      throw new DatabaseError('Failed to find Microsoft tokens');
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  static async getValidToken(userId: string): Promise<string | null> {
    try {
      const tokens = await this.findByUserId(userId);
      
      if (!tokens) {
        return null;
      }

      // Check if token is still valid (with 5 minute buffer)
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (tokens.expiresAt.getTime() - now.getTime() > bufferTime) {
        return tokens.accessToken;
      }

      // Token is expired or about to expire, need to refresh
      if (!tokens.refreshToken) {
        logger.warn('No refresh token available', { userId });
        return null;
      }

      // This would call the refresh token endpoint
      // For now, return null to indicate refresh is needed
      logger.info('Access token needs refresh', { userId });
      return null;
    } catch (error) {
      logger.error('Failed to get valid token', { userId, error });
      return null;
    }
  }

  /**
   * Update tokens after refresh
   */
  static async updateTokens(
    userId: string, 
    accessToken: string, 
    refreshToken?: string,
    expiresIn?: number
  ): Promise<MicrosoftAuthToken> {
    try {
      const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000);
      
      const query = `
        UPDATE microsoft_auth_tokens
        SET access_token = $1,
            refresh_token = COALESCE($2, refresh_token),
            expires_at = $3,
            updated_at = NOW()
        WHERE user_id = $4
        RETURNING *
      `;

      const values = [accessToken, refreshToken, expiresAt, userId];
      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Microsoft auth tokens');
      }

      logger.info('Microsoft tokens updated successfully', { userId });
      
      return this.mapRowToToken(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update Microsoft tokens', { userId, error });
      throw new DatabaseError('Failed to update Microsoft tokens');
    }
  }

  /**
   * Delete tokens for a user
   */
  static async delete(userId: string): Promise<void> {
    try {
      const query = `DELETE FROM microsoft_auth_tokens WHERE user_id = $1`;
      const result = await database.query(query, [userId]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Microsoft auth tokens');
      }

      logger.info('Microsoft auth tokens deleted successfully', { userId });
    } catch (error) {
      logger.error('Failed to delete Microsoft auth tokens', { userId, error });
      throw new DatabaseError('Failed to delete Microsoft auth tokens');
    }
  }

  /**
   * Check if user has valid Microsoft connection
   */
  static async hasValidConnection(userId: string): Promise<boolean> {
    try {
      const tokens = await this.findByUserId(userId);
      
      if (!tokens) {
        return false;
      }

      // Check if we have a refresh token (indicates valid connection)
      return !!tokens.refreshToken;
    } catch (error) {
      logger.error('Failed to check Microsoft connection', { userId, error });
      return false;
    }
  }

  /**
   * Get all users with expiring tokens
   */
  static async getExpiringTokens(minutesBeforeExpiry = 10): Promise<MicrosoftAuthToken[]> {
    try {
      const expiryTime = new Date(Date.now() + minutesBeforeExpiry * 60 * 1000);
      
      const query = `
        SELECT * FROM microsoft_auth_tokens
        WHERE expires_at < $1 AND refresh_token IS NOT NULL
        ORDER BY expires_at ASC
      `;

      const result = await database.query(query, [expiryTime]);
      
      return result.rows.map((row: any) => this.mapRowToToken(row));
    } catch (error) {
      logger.error('Failed to get expiring tokens', error);
      throw new DatabaseError('Failed to get expiring tokens');
    }
  }

  /**
   * Map database row to MicrosoftAuthToken object
   */
  private static mapRowToToken(row: any): MicrosoftAuthToken {
    return new MicrosoftAuthToken({
      id: row.id,
      userId: row.user_id,
      microsoftId: row.microsoft_id,
      email: row.email,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: new Date(row.expires_at),
      scope: row.scope
    });
  }
}