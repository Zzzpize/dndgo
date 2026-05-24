ALTER TABLE monsters
  ADD COLUMN IF NOT EXISTS reactions          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS bonus_actions      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS legendary_actions  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lair_actions       JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS regional_effects   JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS mythic_actions     JSONB NOT NULL DEFAULT '[]';

-- Force reimport with new columns
TRUNCATE monsters;
