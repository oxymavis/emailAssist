-- Migration: Create email_messages table
-- This table stores email messages from connected email accounts

CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL, -- External email provider message ID
    thread_id VARCHAR(255), -- Email thread identifier
    subject TEXT NOT NULL,
    from_data JSONB NOT NULL, -- { "name": "string", "email": "string" }
    to_data JSONB NOT NULL, -- Array of recipient objects
    cc_data JSONB, -- Array of CC recipient objects
    bcc_data JSONB, -- Array of BCC recipient objects
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    body_text TEXT, -- Plain text body
    body_html TEXT, -- HTML body
    has_attachments BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    importance VARCHAR(10) DEFAULT 'normal' CHECK (importance IN ('high', 'normal', 'low')),
    categories TEXT[] DEFAULT '{}', -- Email categories/labels
    folder_path VARCHAR(255) NOT NULL, -- Mail folder path (e.g., 'Inbox', 'Sent')
    raw_data JSONB, -- Complete raw email data from provider
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_importance ON email_messages(importance);
CREATE INDEX IF NOT EXISTS idx_email_messages_folder_path ON email_messages(folder_path);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_received ON email_messages(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_unread ON email_messages(user_id) WHERE is_read = FALSE;

-- Composite index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_email_messages_user_account_received 
ON email_messages(user_id, account_id, received_at DESC);

-- Full text search index for subject and body
CREATE INDEX IF NOT EXISTS idx_email_messages_search 
ON email_messages USING gin(to_tsvector('english', subject || ' ' || COALESCE(body_text, '')));

-- Unique constraint to prevent duplicate messages
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_unique_message 
ON email_messages(user_id, message_id);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_email_messages_updated_at
    BEFORE UPDATE ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_email_messages_updated_at();

-- Add comments for documentation
COMMENT ON TABLE email_messages IS 'Stores email messages from connected email accounts';
COMMENT ON COLUMN email_messages.message_id IS 'External email provider message identifier';
COMMENT ON COLUMN email_messages.thread_id IS 'Email conversation thread identifier';
COMMENT ON COLUMN email_messages.from_data IS 'Sender information as JSON object';
COMMENT ON COLUMN email_messages.to_data IS 'Array of recipient objects';
COMMENT ON COLUMN email_messages.importance IS 'Email importance level: high, normal, or low';
COMMENT ON COLUMN email_messages.categories IS 'Email categories or labels';
COMMENT ON COLUMN email_messages.folder_path IS 'Mail folder location';
COMMENT ON COLUMN email_messages.raw_data IS 'Complete raw email data from email provider';