import bcrypt from 'bcrypt';
import { User, UserSettings, CreateUserRequest, UpdateUserRequest } from '@/types';
import database from '@/config/database';
import config from '@/config';
import logger from '@/utils/logger';
import { DatabaseError, NotFoundError, ConflictError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * User model class
 * Handles all user-related database operations
 */
export class UserModel {
  /**
   * Create a new user
   */
  static async create(userData: CreateUserRequest): Promise<User> {
    try {
      const userId = uuidv4();
      const hashedPassword = userData.password ? await this.hashPassword(userData.password) : null;
      
      const defaultSettings: UserSettings = {
        language: 'zh-CN',
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          frequency: 'immediate'
        },
        analysis: {
          autoAnalyze: true,
          confidenceThreshold: 0.7
        }
      };

      const query = `
        INSERT INTO users (id, email, name, password_hash, settings)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, avatar, role, microsoft_tokens, settings, created_at, updated_at
      `;

      const values = [
        userId,
        userData.email.toLowerCase(),
        userData.name,
        hashedPassword,
        JSON.stringify(defaultSettings)
      ];

      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new DatabaseError('Failed to create user');
      }

      const user = this.mapRowToUser(result.rows[0]);
      logger.info('User created successfully', { userId: user.id, email: user.email });
      
      return user;
    } catch (error) {
      if ((error as any).code === '23505') { // Unique violation
        throw new ConflictError('User with this email already exists');
      }
      logger.error('Failed to create user', error);
      throw new DatabaseError('Failed to create user');
    }
  }

  /**
   * Find user by ID
   */
  static async findById(userId: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, name, avatar, role, microsoft_tokens, settings, created_at, updated_at
        FROM users
        WHERE id = $1
      `;

      const result = await database.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find user by ID', { userId, error });
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const query = `
        SELECT id, email, name, avatar, role, microsoft_tokens, settings, created_at, updated_at
        FROM users
        WHERE email = $1
      `;

      const result = await database.query(query, [email.toLowerCase()]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find user by email', { email, error });
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Update user information
   */
  static async update(userId: string, updateData: UpdateUserRequest): Promise<User> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(updateData.name);
      }

      if (updateData.avatar !== undefined) {
        updates.push(`avatar = $${paramIndex++}`);
        values.push(updateData.avatar);
      }

      if (updateData.settings !== undefined) {
        updates.push(`settings = settings || $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(updateData.settings));
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(userId);
      
      const query = `
        UPDATE users
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, email, name, avatar, role, microsoft_tokens, settings, created_at, updated_at
      `;

      const result = await database.query(query, values);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('User');
      }

      const user = this.mapRowToUser(result.rows[0]);
      logger.info('User updated successfully', { userId: user.id });
      
      return user;
    } catch (error) {
      logger.error('Failed to update user', { userId, error });
      throw new DatabaseError('Failed to update user');
    }
  }

  /**
   * Update Microsoft tokens for user
   */
  static async updateMicrosoftTokens(userId: string, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET microsoft_tokens = $1, updated_at = NOW()
        WHERE id = $2
      `;

      const tokensData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt.toISOString()
      };

      await database.query(query, [JSON.stringify(tokensData), userId]);
      logger.info('Microsoft tokens updated successfully', { userId });
    } catch (error) {
      logger.error('Failed to update Microsoft tokens', { userId, error });
      throw new DatabaseError('Failed to update Microsoft tokens');
    }
  }

  /**
   * Get user's Microsoft tokens
   */
  static async getMicrosoftTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null> {
    try {
      const query = `
        SELECT microsoft_tokens
        FROM users
        WHERE id = $1
      `;

      const result = await database.query(query, [userId]);
      
      if (result.rows.length === 0 || !result.rows[0].microsoft_tokens) {
        return null;
      }

      const tokens = result.rows[0].microsoft_tokens;
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(tokens.expiresAt)
      };
    } catch (error) {
      logger.error('Failed to get Microsoft tokens', { userId, error });
      throw new DatabaseError('Failed to get Microsoft tokens');
    }
  }

  /**
   * Delete user
   */
  static async delete(userId: string): Promise<void> {
    try {
      const query = `DELETE FROM users WHERE id = $1`;
      const result = await database.query(query, [userId]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('User');
      }

      logger.info('User deleted successfully', { userId });
    } catch (error) {
      logger.error('Failed to delete user', { userId, error });
      throw new DatabaseError('Failed to delete user');
    }
  }

  /**
   * Verify user password
   */
  static async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const query = `SELECT password_hash FROM users WHERE id = $1`;
      const result = await database.query(query, [userId]);
      
      if (result.rows.length === 0 || !result.rows[0].password_hash) {
        return false;
      }

      return await bcrypt.compare(password, result.rows[0].password_hash);
    } catch (error) {
      logger.error('Failed to verify password', { userId, error });
      return false;
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await this.hashPassword(newPassword);
      
      const query = `
        UPDATE users
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await database.query(query, [hashedPassword, userId]);
      logger.info('User password updated successfully', { userId });
    } catch (error) {
      logger.error('Failed to update password', { userId, error });
      throw new DatabaseError('Failed to update password');
    }
  }

  /**
   * List users with pagination
   */
  static async list(page = 1, limit = 10, role?: string): Promise<{
    users: User[];
    total: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = '';
      const values: any[] = [limit, offset];
      
      if (role) {
        whereClause = 'WHERE role = $3';
        values.push(role);
      }

      const query = `
        SELECT id, email, name, avatar, role, microsoft_tokens, settings, created_at, updated_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users
        ${whereClause}
      `;

      const [usersResult, countResult] = await Promise.all([
        database.query(query, values),
        database.query(countQuery, role ? [role] : [])
      ]);

      const users = usersResult.rows.map((row: any) => this.mapRowToUser(row));
      const total = parseInt(countResult.rows[0].total, 10);

      return { users, total };
    } catch (error) {
      logger.error('Failed to list users', error);
      throw new DatabaseError('Failed to list users');
    }
  }

  /**
   * Hash password
   */
  private static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, config.env.BCRYPT_ROUNDS);
  }

  /**
   * Map database row to User object
   */
  private static mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      role: row.role,
      microsoftTokens: row.microsoft_tokens ? {
        accessToken: row.microsoft_tokens.accessToken,
        refreshToken: row.microsoft_tokens.refreshToken,
        expiresAt: new Date(row.microsoft_tokens.expiresAt)
      } : undefined,
      settings: row.settings || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}