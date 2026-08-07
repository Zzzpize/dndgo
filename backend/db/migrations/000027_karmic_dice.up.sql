ALTER TABLE game_state
  ADD COLUMN karmic_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN karmic_mode     TEXT    NOT NULL DEFAULT 'protection',
  ADD COLUMN karmic_dm_only  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN karmic_only_d20 BOOLEAN NOT NULL DEFAULT false;
