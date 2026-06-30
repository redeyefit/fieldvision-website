-- FieldVision Supabase Schema v2
-- Adds iOS sync tables + missing projects fields.
-- Idempotent migration: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reuse existing updated_at helper for all sync tables.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- projects: add fields required by iOS serializer (SyncableEntityService)
-- ---------------------------------------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
  ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_user_crud ON projects;
CREATE POLICY projects_user_crud ON projects
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- log_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS log_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  sync_version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  location_label TEXT,
  photo_notes TEXT,
  sheet_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_entries_project_id ON log_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_user_id ON log_entries(user_id);

ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS log_entries_user_crud ON log_entries;
CREATE POLICY log_entries_user_crud ON log_entries
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_log_entries_updated_at ON log_entries;
CREATE TRIGGER update_log_entries_updated_at
  BEFORE UPDATE ON log_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- daily_reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  date TIMESTAMPTZ NOT NULL,
  sync_version INTEGER NOT NULL DEFAULT 1,
  work_status TEXT,
  inspections TEXT,
  rfis TEXT,
  coordination_items TEXT,
  project_name TEXT,
  project_address TEXT,
  ai_context TEXT,
  progress_metrics TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_project_id ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON daily_reports(user_id);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_reports_user_crud ON daily_reports;
CREATE POLICY daily_reports_user_crud ON daily_reports
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_daily_reports_updated_at ON daily_reports;
CREATE TRIGGER update_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- zones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  floor_level INTEGER NOT NULL,
  width_feet DOUBLE PRECISION,
  length_feet DOUBLE PRECISION,
  area_sq_ft DOUBLE PRECISION,
  extracted_from_blueprint BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_project_id ON zones(project_id);
CREATE INDEX IF NOT EXISTS idx_zones_user_id ON zones(user_id);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zones_user_crud ON zones;
CREATE POLICY zones_user_crud ON zones
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_zones_updated_at ON zones;
CREATE TRIGGER update_zones_updated_at
  BEFORE UPDATE ON zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- todo_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS todo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  trade TEXT,
  severity TEXT,
  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todo_items_project_id ON todo_items(project_id);
CREATE INDEX IF NOT EXISTS idx_todo_items_user_id ON todo_items(user_id);

ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS todo_items_user_crud ON todo_items;
CREATE POLICY todo_items_user_crud ON todo_items
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_todo_items_updated_at ON todo_items;
CREATE TRIGGER update_todo_items_updated_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- project_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  content TEXT NOT NULL,
  was_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  detected_action_items JSONB,
  generated_todo_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_user_id ON project_notes(user_id);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_notes_user_crud ON project_notes;
CREATE POLICY project_notes_user_crud ON project_notes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_project_notes_updated_at ON project_notes;
CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  log_entry_id UUID REFERENCES log_entries(id) ON DELETE SET NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_project_id ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_log_entry_id ON photos(log_entry_id);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photos_user_crud ON photos;
CREATE POLICY photos_user_crud ON photos
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_photos_updated_at ON photos;
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- voice_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  file_url TEXT,
  transcript TEXT,
  duration DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_project_id ON voice_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id ON voice_notes(user_id);

ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voice_notes_user_crud ON voice_notes;
CREATE POLICY voice_notes_user_crud ON voice_notes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_voice_notes_updated_at ON voice_notes;
CREATE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- schedule_delays
-- Fields mirrored from ScheduleDelayEvent in iOS model.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_delays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  detected_date TIMESTAMPTZ NOT NULL,
  activity_id UUID NOT NULL,
  trade_affected TEXT NOT NULL,
  delay_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL,
  cascade_impact JSONB,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_delays_project_id ON schedule_delays(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_delays_user_id ON schedule_delays(user_id);

ALTER TABLE schedule_delays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedule_delays_user_crud ON schedule_delays;
CREATE POLICY schedule_delays_user_crud ON schedule_delays
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_schedule_delays_updated_at ON schedule_delays;
CREATE TRIGGER update_schedule_delays_updated_at
  BEFORE UPDATE ON schedule_delays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
