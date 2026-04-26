CREATE TYPE token_type        AS ENUM ('pc', 'npc');
CREATE TYPE token_disposition AS ENUM ('friendly', 'neutral', 'hostile');

CREATE TABLE map_tokens (
    id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id      UUID              NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    token_type   token_type        NOT NULL DEFAULT 'npc',
    character_id UUID              REFERENCES characters(id) ON DELETE SET NULL,
    name         TEXT              NOT NULL DEFAULT '',
    rel_x        FLOAT8            NOT NULL DEFAULT 0,
    rel_y        FLOAT8            NOT NULL DEFAULT 0,
    disposition  token_disposition NOT NULL DEFAULT 'neutral',
    created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_map_tokens_room ON map_tokens(room_id);
