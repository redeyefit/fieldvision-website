-- Schedule Maker Database Schema
-- Run this in Supabase SQL Editor to set up tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE,
  work_days TEXT DEFAULT 'mon-fri' CHECK (work_days IN ('mon-fri', 'mon-sat')),
  user_id TEXT,              -- Clerk user ID (null for anonymous)
  anonymous_id TEXT,         -- HMAC-signed token for anonymous users
  pdf_url TEXT,              -- Vercel Blob URL for uploaded PDF
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Line items extracted from PDF
CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  trade TEXT,
  quantity NUMERIC,
  unit TEXT,
  notes TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated schedule tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  duration_days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  depends_on UUID[] DEFAULT '{}',
  sequence_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_anonymous_id ON projects(anonymous_id);
CREATE INDEX idx_line_items_project_id ON line_items(project_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_sequence ON tasks(project_id, sequence_index);

-- Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
-- Users can read their own projects (by user_id or anonymous_id)
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR anonymous_id = current_setting('request.headers', true)::json->>'x-anonymous-id'
  );

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR anonymous_id IS NOT NULL
  );

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR anonymous_id = current_setting('request.headers', true)::json->>'x-anonymous-id'
  );

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR anonymous_id = current_setting('request.headers', true)::json->>'x-anonymous-id'
  );

-- RLS Policies for line_items (inherit from project ownership)
CREATE POLICY "Users can manage own line items" ON line_items
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR anonymous_id = current_setting('request.headers', true)::json->>'x-anonymous-id'
    )
  );

-- RLS Policies for tasks (inherit from project ownership)
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR anonymous_id = current_setting('request.headers', true)::json->>'x-anonymous-id'
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at
  BEFORE UPDATE ON line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
