ALTER TABLE character_templates ALTER COLUMN max_hp TYPE INT USING (regexp_replace(max_hp, '[^0-9].*', ''))::INT;
ALTER TABLE map_tokens ALTER COLUMN max_hp TYPE INT USING (regexp_replace(max_hp, '[^0-9].*', ''))::INT;
ALTER TABLE npcs ALTER COLUMN max_hp TYPE INT USING (regexp_replace(max_hp, '[^0-9].*', ''))::INT;
ALTER TABLE characters ALTER COLUMN max_hp TYPE INT USING (regexp_replace(max_hp, '[^0-9].*', ''))::INT;
