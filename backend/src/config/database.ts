import { Pool, Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import config from '@/config';
import logger from '@/utils/logger';
import { DatabaseError } from '@/utils/errors';

/**
 * Database connection manager
 * Handles both PostgreSQL direct connections and Supabase client
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool | null = null;
  private supabase: any = null;

  private constructor() {
    // Initialize will be called explicitly
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize PostgreSQL connection pool
      await this.initializePostgreSQL();
      
      // Initialize Supabase client (if configured)
      this.initializeSupabase();
      
      logger.info('Database connections initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connections', error);
      throw new DatabaseError('Database initialization failed');
    }
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private async initializePostgreSQL(): Promise<void> {
    const dbConfig = config.databaseConfig;
    
    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Test the connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }

    // Handle pool events
    this.pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected');
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  /**
   * Initialize Supabase client
   */
  private initializeSupabase(): void {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('Supabase client initialized successfully');
    } else {
      logger.warn('Supabase configuration not found, using PostgreSQL directly');
    }
  }

  /**
   * Get PostgreSQL connection pool
   */
  public getPool(): Pool {
    if (!this.pool) {
      throw new DatabaseError('PostgreSQL pool not initialized');
    }
    return this.pool;
  }

  /**
   * Get Supabase client
   */
  public getSupabase() {
    return this.supabase;
  }

  /**
   * Execute a database query with error handling
   */
  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    const client = await this.getPool().connect();
    
    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      logger.dbOperation('SELECT', 'query', duration);
      return result;
    } catch (error) {
      logger.error('Database query failed', { query: text, params, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed and rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        logger.info('PostgreSQL pool closed');
      }
    } catch (error) {
      logger.error('Error closing database connections', error);
    }
  }

  /**
   * Health check for database connectivity
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export default DatabaseManager.getInstance();

// Export database schema creation functions
export async function createTables(): Promise<void> {
  const db = DatabaseManager.getInstance();
  
  try {
    // Create Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'readonly')),
        password_hash VARCHAR(255),
        microsoft_tokens JSONB,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create Email Accounts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('microsoft', 'gmail', 'exchange')),
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        is_connected BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        sync_status VARCHAR(20) DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
        error_message TEXT,
        folder_structure JSONB DEFAULT '{}',
        sync_settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, email)
      );
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
      CREATE INDEX IF NOT EXISTS idx_email_accounts_is_connected ON email_accounts(is_connected);
    `);

    // Create updated_at trigger function
    await db.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers
    await db.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW 
        EXECUTE PROCEDURE update_updated_at_column();
    `);

    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Failed to create database tables', error);
    throw new DatabaseError('Table creation failed');
  }
}