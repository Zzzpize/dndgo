CREATE TABLE npcs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id        UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    disposition    token_disposition NOT NULL DEFAULT 'hostile',
    ac             TEXT NOT NULL DEFAULT '10',
    max_hp         INT  NOT NULL DEFAULT 1,
    speed          TEXT NOT NULL DEFAULT '30 фт.',
    type_alignment TEXT NOT NULL DEFAULT '',
    abilities      JSONB NOT NULL DEFAULT '{}',
    actions        JSONB NOT NULL DEFAULT '[]',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_npcs_room ON npcs(room_id);
