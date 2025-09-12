-- Email Assist Development Database Initialization Script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types (same as production but with dev data)
CREATE TYPE email_status AS ENUM ('unread', 'read', 'archived', 'deleted');
CREATE TYPE analysis_sentiment AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE integration_type AS ENUM ('gmail', 'outlook', 'exchange', 'imap');
CREATE TYPE task_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create all tables (same structure as production)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert development users
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, email_verified)
VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    'admin@emailassist.dev',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6DjNRtLsMO', -- password: admin123
    'Development',
    'Admin',
    true,
    true
),
(
    '00000000-0000-0000-0000-000000000002',
    'user@emailassist.dev',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6DjNRtLsMO', -- password: admin123
    'Test',
    'User',
    true,
    true
);

-- Create other tables with minimal structure for development
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    provider integration_type NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_address)
);

-- Insert sample email account
INSERT INTO email_accounts (id, user_id, email_address, provider, is_active, sync_enabled)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'admin@emailassist.dev',
    'gmail',
    true,
    true
);

-- Create emails table with sample data
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    subject TEXT,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_emails TEXT[],
    cc_emails TEXT[],
    bcc_emails TEXT[],
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]',
    labels TEXT[],
    status email_status DEFAULT 'unread',
    is_important BOOLEAN DEFAULT false,
    received_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, message_id)
);

-- Insert sample emails
INSERT INTO emails (id, account_id, message_id, subject, sender_email, sender_name, body_text, status, received_at, sent_at)
VALUES 
(
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000003',
    'dev-msg-001',
    'Welcome to Email Assist Development',
    'system@emailassist.dev',
    'Email Assist System',
    'This is a sample email for development and testing purposes.',
    'unread',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000003',
    'dev-msg-002',
    'High Priority Task Reminder',
    'tasks@company.dev',
    'Task Management',
    'This is a high priority task reminder for testing.',
    'read',
    CURRENT_TIMESTAMP - INTERVAL '1 hour',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Development specific configurations
ALTER DATABASE email_assist_dev SET log_statement = 'all';
ALTER DATABASE email_assist_dev SET log_min_duration_statement = 0;