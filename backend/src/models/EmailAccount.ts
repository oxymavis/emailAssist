/**
 * Email Account Model
 * Manages user's connected email accounts from various providers
 */

import { v4 as uuidv4 } from 'uuid';
import database from '@/config/database';
import logger from '@/utils/logger';
import { DatabaseError, NotFoundError, ConflictError } from '@/utils/errors';

export enum EmailProvider {
  MICROSOFT = 'microsoft',
  GMAIL = 'gmail',
  IMAP = 'imap',
  EXCHANGE = 'exchange'
}

export interface EmailAccountData {
  id?: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  displayName?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  syncEnabled?: boolean;
  lastSyncAt?: Date;
  syncFrequencyMinutes?: number;
  connectionConfig?: any;
}

export class EmailAccount {
  id: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  displayName?: string;
  isPrimary: boolean;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt?: Date;
  syncFrequencyMinutes: number;
  connectionConfig: any;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: EmailAccountData) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.provider = data.provider;
    this.emailAddress = data.emailAddress;
    this.displayName = data.displayName;
    this.isPrimary = data.isPrimary || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.syncEnabled = data.syncEnabled !== undefined ? data.syncEnabled : true;
    this.lastSyncAt = data.lastSyncAt;
    this.syncFrequencyMinutes = data.syncFrequencyMinutes || 5;
    this.connectionConfig = data.connectionConfig || {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Create a new email account
   */
  static async create(accountData: EmailAccountData): Promise<EmailAccount> {
    try {
      const account = new EmailAccount(accountData);
      
      // If this is the first account for the user, make it primary
      const existingAccounts = await this.findByUserId(account.userId);
      if (existingAccounts.length === 0) {
        account.isPrimary = true;
      }
      
      const query = `
        INSERT INTO email_accounts (
          id, user_id, provider, email_address, display_name,
          is_primary, is_active, sync_enabled, sync_frequency_minutes,
          connection_config, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        account.id,
        account.userId,
        account.provider,
        account.emailAddress.toLowerCase(),
        account.displayName || account.emailAddress,
        account.isPrimary,
        account.isActive,
        account.syncEnabled,
        account.syncFrequencyMinutes,
        JSON.stringify(account.connectionConfig),
        account.createdAt,
        account.updatedAt
      ];

      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to create email account');
      }

      logger.info('Email account created successfully', { 
        accountId: account.id, 
        userId: account.userId,
        email: account.emailAddress 
      });
      
      return this.mapRowToAccount(result.rows[0]);
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new ConflictError('Email account already exists for this user');
      }
      logger.error('Failed to create email account', error);
      throw new DatabaseError('Failed to create email account');
    }
  }

  /**
   * Find email account by ID
   */
  static async findById(accountId: string): Promise<EmailAccount | null> {
    try {
      const query = `
        SELECT * FROM email_accounts
        WHERE id = $1
      `;

      const result = await database.query(query, [accountId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAccount(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find email account by ID', { accountId, error });
      throw new DatabaseError('Failed to find email account');
    }
  }

  /**
   * Find all email accounts for a user
   */
  static async findByUserId(userId: string): Promise<EmailAccount[]> {
    try {
      const query = `
        SELECT * FROM email_accounts
        WHERE user_id = $1
        ORDER BY is_primary DESC, created_at ASC
      `;

      const result = await database.query(query, [userId]);
      
      return result.rows.map((row: any) => this.mapRowToAccount(row));
    } catch (error) {
      logger.error('Failed to find email accounts for user', { userId, error });
      throw new DatabaseError('Failed to find email accounts');
    }
  }

  /**
   * Find primary email account for a user
   */
  static async findPrimaryByUserId(userId: string): Promise<EmailAccount | null> {
    try {
      const query = `
        SELECT * FROM email_accounts
        WHERE user_id = $1 AND is_primary = true
        LIMIT 1
      `;

      const result = await database.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAccount(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find primary email account', { userId, error });
      throw new DatabaseError('Failed to find primary email account');
    }
  }

  /**
   * Update email account
   */
  static async update(accountId: string, updateData: Partial<EmailAccountData>): Promise<EmailAccount> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.displayName !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        values.push(updateData.displayName);
      }

      if (updateData.isPrimary !== undefined) {
        updates.push(`is_primary = $${paramIndex++}`);
        values.push(updateData.isPrimary);
      }

      if (updateData.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(updateData.isActive);
      }

      if (updateData.syncEnabled !== undefined) {
        updates.push(`sync_enabled = $${paramIndex++}`);
        values.push(updateData.syncEnabled);
      }

      if (updateData.syncFrequencyMinutes !== undefined) {
        updates.push(`sync_frequency_minutes = $${paramIndex++}`);
        values.push(updateData.syncFrequencyMinutes);
      }

      if (updateData.connectionConfig !== undefined) {
        updates.push(`connection_config = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.connectionConfig));
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(accountId);
      
      const query = `
        UPDATE email_accounts
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Email account');
      }

      logger.info('Email account updated successfully', { accountId });
      
      return this.mapRowToAccount(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update email account', { accountId, error });
      throw new DatabaseError('Failed to update email account');
    }
  }

  /**
   * Update last sync time
   */
  static async updateLastSync(accountId: string): Promise<void> {
    try {
      const query = `
        UPDATE email_accounts
        SET last_sync_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `;

      await database.query(query, [accountId]);
      logger.info('Email account sync time updated', { accountId });
    } catch (error) {
      logger.error('Failed to update sync time', { accountId, error });
      throw new DatabaseError('Failed to update sync time');
    }
  }

  /**
   * Set primary account for user
   */
  static async setPrimary(userId: string, accountId: string): Promise<void> {
    try {
      // Start transaction
      await database.query('BEGIN');

      // Remove primary flag from all accounts
      await database.query(
        'UPDATE email_accounts SET is_primary = false WHERE user_id = $1',
        [userId]
      );

      // Set new primary account
      const result = await database.query(
        'UPDATE email_accounts SET is_primary = true WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Email account');
      }

      await database.query('COMMIT');
      logger.info('Primary email account updated', { userId, accountId });
    } catch (error) {
      await database.query('ROLLBACK');
      logger.error('Failed to set primary account', { userId, accountId, error });
      throw new DatabaseError('Failed to set primary account');
    }
  }

  /**
   * Delete email account
   */
  static async delete(accountId: string): Promise<void> {
    try {
      const query = `DELETE FROM email_accounts WHERE id = $1`;
      const result = await database.query(query, [accountId]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Email account');
      }

      logger.info('Email account deleted successfully', { accountId });
    } catch (error) {
      logger.error('Failed to delete email account', { accountId, error });
      throw new DatabaseError('Failed to delete email account');
    }
  }

  /**
   * Get accounts that need syncing
   */
  static async getAccountsForSync(limit = 10): Promise<EmailAccount[]> {
    try {
      const query = `
        SELECT * FROM email_accounts
        WHERE is_active = true 
          AND sync_enabled = true
          AND (
            last_sync_at IS NULL 
            OR last_sync_at < NOW() - INTERVAL '1 minute' * sync_frequency_minutes
          )
        ORDER BY last_sync_at ASC NULLS FIRST
        LIMIT $1
      `;

      const result = await database.query(query, [limit]);
      
      return result.rows.map((row: any) => this.mapRowToAccount(row));
    } catch (error) {
      logger.error('Failed to get accounts for sync', error);
      throw new DatabaseError('Failed to get accounts for sync');
    }
  }

  /**
   * Map database row to EmailAccount object
   */
  private static mapRowToAccount(row: any): EmailAccount {
    return new EmailAccount({
      id: row.id,
      userId: row.user_id,
      provider: row.provider as EmailProvider,
      emailAddress: row.email_address,
      displayName: row.display_name,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      syncEnabled: row.sync_enabled,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      syncFrequencyMinutes: row.sync_frequency_minutes,
      connectionConfig: row.connection_config || {}
    });
  }
}