CREATE TABLE game_state (
    room_id           UUID        PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    map_image_url     TEXT        NOT NULL DEFAULT '',
    grid_enabled      BOOL        NOT NULL DEFAULT true,
    grid_size         INT         NOT NULL DEFAULT 50,
    fog_cells         JSONB       NOT NULL DEFAULT '[]',
    initiative_order  JSONB       NOT NULL DEFAULT '[]',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
