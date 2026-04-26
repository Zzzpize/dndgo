CREATE TABLE characters (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    class       TEXT        NOT NULL DEFAULT '',
    race        TEXT        NOT NULL DEFAULT '',
    level       INT         NOT NULL DEFAULT 1,
    hp          INT         NOT NULL DEFAULT 1,
    max_hp      INT         NOT NULL DEFAULT 1,
    ac          INT         NOT NULL DEFAULT 10,
    stats       JSONB       NOT NULL DEFAULT '{}',
    weapons     JSONB       NOT NULL DEFAULT '[]',
    spell_slots JSONB       NOT NULL DEFAULT '{}',
    notes       TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_characters_room ON characters(room_id);
CREATE INDEX idx_characters_user ON characters(user_id);
