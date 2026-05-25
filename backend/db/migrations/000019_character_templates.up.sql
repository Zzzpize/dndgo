CREATE TABLE character_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  class       TEXT NOT NULL DEFAULT '',
  subclass    TEXT NOT NULL DEFAULT '',
  race        TEXT NOT NULL DEFAULT '',
  subrace     TEXT NOT NULL DEFAULT '',
  level       INT NOT NULL DEFAULT 1,
  hp          INT NOT NULL DEFAULT 10,
  max_hp      INT NOT NULL DEFAULT 10,
  temp_hp     INT NOT NULL DEFAULT 0,
  ac          INT NOT NULL DEFAULT 10,
  stats       JSONB NOT NULL DEFAULT '{}',
  weapons     JSONB NOT NULL DEFAULT '[]',
  spell_slots JSONB NOT NULL DEFAULT '{}',
  abilities   JSONB NOT NULL DEFAULT '[]',
  inventory   TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_character_templates_user ON character_templates(user_id);
