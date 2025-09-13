-- Microsoft Authentication Tokens Table
-- This table stores Microsoft OAuth tokens separately from the main users table
-- for better security and management

CREATE TABLE IF NOT EXISTS microsoft_auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL, -- Can be UUID or temp identifier before user creation
    microsoft_id VARCHAR(255) NOT NULL, -- Microsoft user ID
    email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one token set per user
    UNIQUE(user_id),
    -- Ensure email uniqueness
    UNIQUE(email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_microsoft_auth_tokens_user_id ON microsoft_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_auth_tokens_email ON microsoft_auth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_microsoft_auth_tokens_microsoft_id ON microsoft_auth_tokens(microsoft_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_auth_tokens_expires_at ON microsoft_auth_tokens(expires_at);

-- Create update trigger
DROP TRIGGER IF EXISTS update_microsoft_auth_tokens_updated_at ON microsoft_auth_tokens;
CREATE TRIGGER update_microsoft_auth_tokens_updated_at 
  BEFORE UPDATE ON microsoft_auth_tokens 
  FOR EACH ROW 
  EXECUTE PROCEDURE update_updated_at_column();