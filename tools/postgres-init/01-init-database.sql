-- AI Validation Platform Database Initialization

-- Create development database (already created by environment variable)
-- CREATE DATABASE ai_validation_platform;

-- Create basic schema for development
-- This will be replaced with Prisma migrations in future story

-- Users table (placeholder for future authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business evaluations table
CREATE TABLE IF NOT EXISTS business_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
    urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high')),
    industry VARCHAR(100),
    target_market VARCHAR(255),
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent executions table
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES business_evaluations(id) ON DELETE CASCADE,
    agent_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_evaluations_status ON business_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_business_evaluations_created_at ON business_evaluations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_executions_evaluation_id ON agent_executions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_business_evaluations_updated_at
    BEFORE UPDATE ON business_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO business_evaluations (description, urgency, industry) VALUES
    ('AI-powered personal fitness coach app', 'medium', 'Health & Fitness'),
    ('Sustainable packaging solution for e-commerce', 'high', 'Sustainability')
ON CONFLICT DO NOTHING;