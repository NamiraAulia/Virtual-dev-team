-- ============================================================
-- Autonomous AI Dev Engine — Supabase Schema Migration
-- Sprint 1: Core tables for tasks, patches, and task_logs
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------ --
-- 1. Tasks table
-- ------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    repo_full_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'exploring', 'patch_ready', 'approved', 'pr_created', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing tasks by status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);


-- ------------------------------------------------------------ --
-- 2. Patches table
-- ------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS patches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    search_block TEXT NOT NULL,
    replace_block TEXT NOT NULL,
    explanation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching patches by task
CREATE INDEX IF NOT EXISTS idx_patches_task_id ON patches (task_id);


-- ------------------------------------------------------------ --
-- 3. Task Logs table (audit trail)
-- ------------------------------------------------------------ --

CREATE TABLE IF NOT EXISTS task_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input JSONB NOT NULL DEFAULT '{}',
    tool_output TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching logs by task, ordered by step
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs (task_id, step_number);


-- ------------------------------------------------------------ --
-- Row Level Security (RLS) & Policies (Safe Re-run)
-- ------------------------------------------------------------ --

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists before recreating
DROP POLICY IF EXISTS "Service role full access on tasks" ON tasks;
CREATE POLICY "Service role full access on tasks"
    ON tasks FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on patches" ON patches;
CREATE POLICY "Service role full access on patches"
    ON patches FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on task_logs" ON task_logs;
CREATE POLICY "Service role full access on task_logs"
    ON task_logs FOR ALL
    USING (true)
    WITH CHECK (true);
