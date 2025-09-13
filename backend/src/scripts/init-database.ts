/**
 * Database initialization script
 * Creates all necessary tables and initial data
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'email_assist',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

/**
 * Read and execute SQL file
 */
async function executeSQLFile(filePath: string): Promise<void> {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolons but ignore those within strings
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    for (const statement of statements) {
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.length < 5) {
        continue;
      }
      
      // Special handling for CREATE DATABASE
      if (statement.toUpperCase().includes('CREATE DATABASE')) {
        console.log('⚠️  Skipping CREATE DATABASE (database should already exist)');
        continue;
      }
      
      // Special handling for \\c command
      if (statement.includes('\\c ')) {
        console.log('⚠️  Skipping psql meta-command');
        continue;
      }
      
      try {
        await pool.query(statement);
        
        // Log important operations
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`✅ Created table: ${tableName}`);
        } else if (statement.toUpperCase().includes('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
          console.log(`📑 Created index: ${indexName}`);
        } else if (statement.toUpperCase().includes('CREATE FUNCTION')) {
          console.log(`🔧 Created function`);
        } else if (statement.toUpperCase().includes('CREATE TRIGGER')) {
          const triggerName = statement.match(/CREATE TRIGGER (\w+)/i)?.[1];
          console.log(`⚡ Created trigger: ${triggerName}`);
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.code === '42P07' || error.code === '42710') {
          console.log(`ℹ️  Object already exists, skipping...`);
        } else {
          console.error(`❌ Error executing statement:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to read SQL file:', error);
    throw error;
  }
}

/**
 * Initialize database
 */
async function initDatabase(): Promise<void> {
  console.log('🚀 Starting database initialization...\n');
  
  try {
    // Check connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log(`📅 Server time: ${result.rows[0].now}\n`);
    
    // Enable UUID extension
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension enabled\n');
    } catch (error) {
      console.log('ℹ️  UUID extension might already be enabled\n');
    }
    
    // Execute main schema file
    const schemaPath = path.join(__dirname, '../config/database-schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📄 Executing database schema...\n');
      await executeSQLFile(schemaPath);
    } else {
      console.log('⚠️  Schema file not found, creating basic tables...\n');
      await createBasicTables();
    }
    
    // Insert initial data
    await insertInitialData();
    
    console.log('\n✨ Database initialization completed successfully!');
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Create basic tables if schema file not found
 */
async function createBasicTables(): Promise<void> {
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      full_name VARCHAR(255),
      avatar_url TEXT,
      role VARCHAR(50) DEFAULT 'user',
      is_active BOOLEAN DEFAULT true,
      language VARCHAR(10) DEFAULT 'zh-CN',
      timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP WITH TIME ZONE,
      settings JSONB DEFAULT '{}'::jsonb
    )
  `);
  console.log('✅ Created table: users');
  
  // Microsoft auth tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS microsoft_auth_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      microsoft_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      scope TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `);
  console.log('✅ Created table: microsoft_auth_tokens');
  
  // Email accounts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      email_address VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      is_primary BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      sync_enabled BOOLEAN DEFAULT true,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      sync_frequency_minutes INTEGER DEFAULT 5,
      connection_config JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email_address)
    )
  `);
  console.log('✅ Created table: email_accounts');
  
  // Create indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_microsoft_auth_user_id ON microsoft_auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
  `);
  console.log('📑 Created indexes');
}

/**
 * Insert initial data
 */
async function insertInitialData(): Promise<void> {
  console.log('\n📝 Inserting initial data...\n');
  
  try {
    // Check if system_settings table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      )
    `);
    
    if (tableExists.rows[0].exists) {
      // Insert default system settings
      await pool.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES 
          ('ai_analysis_enabled', '{"enabled": true, "provider": "openai", "model": "gpt-4"}', 'AI analysis configuration'),
          ('email_sync_interval', '{"minutes": 5}', 'Default email sync interval'),
          ('max_emails_per_sync', '{"count": 100}', 'Maximum emails to sync per operation'),
          ('report_retention_days', '{"days": 90}', 'Number of days to retain generated reports')
        ON CONFLICT (key) DO NOTHING
      `);
      console.log('✅ System settings initialized');
    }
    
    // Create demo user (optional, for testing)
    if (process.env.CREATE_DEMO_USER === 'true') {
      await pool.query(`
        INSERT INTO users (email, username, full_name, role)
        VALUES ('demo@example.com', 'demo', 'Demo User', 'user')
        ON CONFLICT (email) DO NOTHING
      `);
      console.log('✅ Demo user created');
    }
  } catch (error) {
    console.log('ℹ️  Some initial data might already exist');
  }
}

// Run the initialization
if (require.main === module) {
  initDatabase().catch(console.error);
}

export { initDatabase };