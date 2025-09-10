-- Migration: Create email_analysis table
-- This table stores AI analysis results for email messages

CREATE TABLE IF NOT EXISTS email_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    analysis_version VARCHAR(50) NOT NULL DEFAULT '1.0', -- AI model version used
    sentiment_data JSONB NOT NULL, -- Sentiment analysis results
    priority_data JSONB NOT NULL, -- Priority analysis results  
    category_data JSONB NOT NULL, -- Category classification results
    keywords TEXT[] DEFAULT '{}', -- Extracted keywords
    entities_data JSONB DEFAULT '[]', -- Named entity recognition results
    summary TEXT NOT NULL, -- AI-generated summary
    suggested_actions_data JSONB DEFAULT '[]', -- Suggested actions array
    processing_time INTEGER NOT NULL DEFAULT 0, -- Processing time in milliseconds
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analysis_analyzed_at ON email_analysis(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_analysis_version ON email_analysis(analysis_version);

-- Performance indexes for filtering by analysis results
CREATE INDEX IF NOT EXISTS idx_email_analysis_priority 
ON email_analysis USING gin((priority_data->>'level'));

CREATE INDEX IF NOT EXISTS idx_email_analysis_sentiment 
ON email_analysis USING gin((sentiment_data->>'label'));

CREATE INDEX IF NOT EXISTS idx_email_analysis_category 
ON email_analysis USING gin((category_data->>'primary'));

-- Full text search index for keywords and summary
CREATE INDEX IF NOT EXISTS idx_email_analysis_keywords 
ON email_analysis USING gin(keywords);

CREATE INDEX IF NOT EXISTS idx_email_analysis_summary_search 
ON email_analysis USING gin(to_tsvector('english', summary));

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_email_analysis_email_analyzed 
ON email_analysis(email_id, analyzed_at DESC);

-- Unique constraint to prevent duplicate analysis per email (latest version wins)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_analysis_unique_latest 
ON email_analysis(email_id) 
WHERE analyzed_at = (
    SELECT MAX(analyzed_at) 
    FROM email_analysis AS ea2 
    WHERE ea2.email_id = email_analysis.email_id
);

-- Update trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_email_analysis_updated_at
    BEFORE UPDATE ON email_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_email_analysis_updated_at();

-- Cleanup trigger to keep only latest analysis per email (optional - for storage optimization)
CREATE OR REPLACE FUNCTION cleanup_old_email_analysis()
RETURNS TRIGGER AS $$
BEGIN
    -- Keep only the 3 most recent analyses per email
    DELETE FROM email_analysis 
    WHERE email_id = NEW.email_id 
    AND id NOT IN (
        SELECT id FROM email_analysis 
        WHERE email_id = NEW.email_id 
        ORDER BY analyzed_at DESC 
        LIMIT 3
    );
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Optional: Enable this trigger if you want automatic cleanup
-- CREATE TRIGGER trigger_cleanup_old_analysis
--     AFTER INSERT ON email_analysis
--     FOR EACH ROW
--     EXECUTE FUNCTION cleanup_old_email_analysis();

-- Create views for common analysis queries
CREATE OR REPLACE VIEW email_analysis_summary AS
SELECT 
    ea.id,
    ea.email_id,
    em.user_id,
    em.subject,
    em.from_data->>'email' as sender_email,
    em.received_at,
    ea.sentiment_data->>'label' as sentiment,
    (ea.sentiment_data->>'confidence')::float as sentiment_confidence,
    ea.priority_data->>'level' as priority,
    (ea.priority_data->>'confidence')::float as priority_confidence,
    ea.category_data->>'primary' as primary_category,
    ea.keywords,
    ea.summary,
    ea.processing_time,
    ea.analyzed_at
FROM email_analysis ea
JOIN email_messages em ON ea.email_id = em.id
ORDER BY ea.analyzed_at DESC;

-- Create view for priority distribution
CREATE OR REPLACE VIEW priority_distribution AS
SELECT 
    em.user_id,
    ea.priority_data->>'level' as priority_level,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY em.user_id), 2) as percentage
FROM email_analysis ea
JOIN email_messages em ON ea.email_id = em.id
GROUP BY em.user_id, ea.priority_data->>'level';

-- Create view for sentiment trends
CREATE OR REPLACE VIEW sentiment_trends AS
SELECT 
    em.user_id,
    DATE_TRUNC('day', ea.analyzed_at) as analysis_date,
    ea.sentiment_data->>'label' as sentiment,
    COUNT(*) as count,
    AVG((ea.sentiment_data->>'confidence')::float) as avg_confidence
FROM email_analysis ea
JOIN email_messages em ON ea.email_id = em.id
GROUP BY em.user_id, DATE_TRUNC('day', ea.analyzed_at), ea.sentiment_data->>'label'
ORDER BY analysis_date DESC;

-- Add comments for documentation
COMMENT ON TABLE email_analysis IS 'Stores AI analysis results for email messages';
COMMENT ON COLUMN email_analysis.analysis_version IS 'Version of AI model used for analysis';
COMMENT ON COLUMN email_analysis.sentiment_data IS 'JSON object containing sentiment analysis results';
COMMENT ON COLUMN email_analysis.priority_data IS 'JSON object containing priority level and confidence';
COMMENT ON COLUMN email_analysis.category_data IS 'JSON object containing category classification';
COMMENT ON COLUMN email_analysis.keywords IS 'Array of extracted keywords from email content';
COMMENT ON COLUMN email_analysis.entities_data IS 'JSON array of named entities found in email';
COMMENT ON COLUMN email_analysis.summary IS 'AI-generated summary of email content';
COMMENT ON COLUMN email_analysis.suggested_actions_data IS 'JSON array of suggested actions';
COMMENT ON COLUMN email_analysis.processing_time IS 'Time taken to analyze email in milliseconds';

-- Example of sentiment_data structure:
-- {
--   "label": "positive|negative|neutral",
--   "confidence": 0.85,
--   "emotions": {
--     "joy": 0.7,
--     "anger": 0.1,
--     "fear": 0.05,
--     "sadness": 0.15
--   }
-- }

-- Example of priority_data structure:
-- {
--   "level": "critical|high|medium|low",
--   "confidence": 0.92,
--   "reasons": ["urgent deadline mentioned", "CEO is sender"]
-- }

-- Example of category_data structure:
-- {
--   "primary": "Project Management",
--   "secondary": "Task Assignment", 
--   "confidence": 0.88
-- }

-- Example of entities_data structure:
-- [
--   {
--     "type": "person",
--     "value": "John Smith",
--     "confidence": 0.95
--   },
--   {
--     "type": "datetime",
--     "value": "2024-12-01",
--     "confidence": 0.90
--   }
-- ]