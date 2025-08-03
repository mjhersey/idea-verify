-- AI Validation Platform Database Schema
-- This schema matches the TypeScript types in @ai-validation/shared

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS agent_results CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS business_ideas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business Ideas table
CREATE TABLE business_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'evaluating', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evaluations table
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_idea_id UUID NOT NULL REFERENCES business_ideas(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    results JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Results table
CREATE TABLE agent_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    agent_type VARCHAR(100) NOT NULL CHECK (agent_type IN (
        'market-research',
        'competitive-analysis',
        'customer-research',
        'technical-feasibility',
        'financial-analysis'
    )),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    input_data JSONB,
    output_data JSONB,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    insights JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_business_ideas_user_id ON business_ideas(user_id);
CREATE INDEX idx_business_ideas_status ON business_ideas(status);
CREATE INDEX idx_business_ideas_created_at ON business_ideas(created_at);
CREATE INDEX idx_evaluations_business_idea_id ON evaluations(business_idea_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_evaluations_priority ON evaluations(priority);
CREATE INDEX idx_evaluations_created_at ON evaluations(created_at);
CREATE INDEX idx_agent_results_evaluation_id ON agent_results(evaluation_id);
CREATE INDEX idx_agent_results_agent_type ON agent_results(agent_type);
CREATE INDEX idx_agent_results_status ON agent_results(status);
CREATE INDEX idx_agent_results_score ON agent_results(score);
CREATE INDEX idx_agent_results_created_at ON agent_results(created_at);

-- Create updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_ideas_updated_at
    BEFORE UPDATE ON business_ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at
    BEFORE UPDATE ON evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_results_updated_at
    BEFORE UPDATE ON agent_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO users (email, password_hash, name) VALUES
    ('john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Ott8F8F8F8F8F8F8F8', 'John Doe'),
    ('jane.smith@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Ott8F8F8F8F8F8F8F8', 'Jane Smith')
ON CONFLICT (email) DO NOTHING;

-- Get user IDs for sample data
DO $$
DECLARE
    john_id UUID;
    jane_id UUID;
    idea1_id UUID;
    idea2_id UUID;
    eval1_id UUID;
    eval2_id UUID;
BEGIN
    SELECT id INTO john_id FROM users WHERE email = 'john.doe@example.com';
    SELECT id INTO jane_id FROM users WHERE email = 'jane.smith@example.com';
    
    -- Insert sample business ideas
    INSERT INTO business_ideas (user_id, title, description, status) VALUES
        (john_id, 'AI-Powered Fitness Tracking App', 'A mobile app that uses AI to provide personalized fitness recommendations and workout plans based on user goals, progress, and preferences.', 'submitted'),
        (jane_id, 'Sustainable E-commerce Packaging Platform', 'A platform that connects e-commerce businesses with sustainable packaging suppliers, reducing environmental impact while maintaining cost-effectiveness.', 'submitted')
    ON CONFLICT DO NOTHING
    RETURNING id;
    
    -- Get business idea IDs
    SELECT id INTO idea1_id FROM business_ideas WHERE title = 'AI-Powered Fitness Tracking App';
    SELECT id INTO idea2_id FROM business_ideas WHERE title = 'Sustainable E-commerce Packaging Platform';
    
    -- Insert sample evaluations
    INSERT INTO evaluations (business_idea_id, status, priority) VALUES
        (idea1_id, 'pending', 'normal'),
        (idea2_id, 'pending', 'high')
    ON CONFLICT DO NOTHING;
    
END $$;

-- Create views for common queries
CREATE OR REPLACE VIEW evaluation_summary AS
SELECT 
    e.id,
    e.status,
    e.priority,
    e.created_at,
    e.started_at,
    e.completed_at,
    bi.title as business_idea_title,
    bi.description as business_idea_description,
    u.name as user_name,
    u.email as user_email,
    COUNT(ar.id) as total_agents,
    COUNT(CASE WHEN ar.status = 'completed' THEN 1 END) as completed_agents,
    COUNT(CASE WHEN ar.status = 'failed' THEN 1 END) as failed_agents,
    AVG(ar.score) as average_score
FROM evaluations e
JOIN business_ideas bi ON e.business_idea_id = bi.id
JOIN users u ON bi.user_id = u.id
LEFT JOIN agent_results ar ON e.id = ar.evaluation_id
GROUP BY e.id, e.status, e.priority, e.created_at, e.started_at, e.completed_at,
         bi.title, bi.description, u.name, u.email;

-- Create a view for agent performance statistics
CREATE OR REPLACE VIEW agent_performance AS
SELECT 
    agent_type,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / 
        COUNT(*)::DECIMAL * 100, 2
    ) as success_rate_percent,
    AVG(score) as average_score,
    MIN(score) as min_score,
    MAX(score) as max_score,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_execution_time_seconds
FROM agent_results
WHERE started_at IS NOT NULL
GROUP BY agent_type;