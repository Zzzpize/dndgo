CREATE TYPE room_role AS ENUM ('dm', 'player');

CREATE TABLE rooms (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(6)  NOT NULL UNIQUE,
    name        TEXT        NOT NULL,
    dm_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_members (
    room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       room_role   NOT NULL DEFAULT 'player',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_rooms_code        ON rooms(code);
CREATE INDEX idx_room_members_user ON room_members(user_id);
