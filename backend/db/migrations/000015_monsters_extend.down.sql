ALTER TABLE monsters
  DROP COLUMN IF EXISTS reactions,
  DROP COLUMN IF EXISTS bonus_actions,
  DROP COLUMN IF EXISTS legendary_actions,
  DROP COLUMN IF EXISTS lair_actions,
  DROP COLUMN IF EXISTS regional_effects,
  DROP COLUMN IF EXISTS mythic_actions;
