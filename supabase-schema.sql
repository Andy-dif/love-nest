-- ============================================
-- 恋爱小窝 - Supabase Database Schema
-- Run this in your Supabase SQL Editor:
-- https://app.supabase.com -> Your Project -> SQL Editor
-- ============================================

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE pet_state;
ALTER PUBLICATION supabase_realtime ADD TABLE love_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- 1. Pet State Table
CREATE TABLE IF NOT EXISTS pet_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT '小团子',
    hunger INTEGER NOT NULL DEFAULT 100 CHECK (hunger >= 0 AND hunger <= 100),
    happiness INTEGER NOT NULL DEFAULT 100 CHECK (happiness >= 0 AND happiness <= 100),
    energy INTEGER NOT NULL DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
    evolution_stage INTEGER NOT NULL DEFAULT 1 CHECK (evolution_stage >= 1 AND evolution_stage <= 5),
    last_fed_at TIMESTAMPTZ,
    last_played_at TIMESTAMPTZ,
    last_slept_at TIMESTAMPTZ,
    last_loved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT ''
);

-- Insert initial pet state
INSERT INTO pet_state (id, name, hunger, happiness, energy, evolution_stage)
VALUES (1, '小团子', 100, 100, 100, 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Love Notes Table
CREATE TABLE IF NOT EXISTS love_notes (
    id BIGSERIAL PRIMARY KEY,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (allow all for simplicity - private app)
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on love_notes" ON love_notes FOR ALL USING (true);

-- 3. Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on activity_log" ON activity_log FOR ALL USING (true);

-- 4. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    anniversary DATE DEFAULT '2024-01-01',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (id, anniversary)
VALUES (1, '2024-01-01')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true);

-- Also allow public access to pet_state
ALTER TABLE pet_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pet_state" ON pet_state FOR ALL USING (true);
