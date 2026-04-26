CREATE TABLE game_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    event_type  TEXT        NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_events_room_time ON game_events(room_id, created_at DESC);
