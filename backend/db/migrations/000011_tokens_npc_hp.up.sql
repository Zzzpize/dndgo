ALTER TABLE map_tokens
    ADD COLUMN npc_id     UUID REFERENCES npcs(id) ON DELETE SET NULL,
    ADD COLUMN current_hp INT,
    ADD COLUMN max_hp     INT;
