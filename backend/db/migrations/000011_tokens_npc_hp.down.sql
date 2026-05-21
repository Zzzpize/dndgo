ALTER TABLE map_tokens
    DROP COLUMN IF EXISTS npc_id,
    DROP COLUMN IF EXISTS current_hp,
    DROP COLUMN IF EXISTS max_hp;
