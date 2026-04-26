CREATE TABLE monsters (
    id                SERIAL PRIMARY KEY,
    name_ru           TEXT   NOT NULL UNIQUE,
    name_en           TEXT   NOT NULL DEFAULT '',
    type_and_alignment TEXT  NOT NULL DEFAULT '',
    armor_class       TEXT   NOT NULL DEFAULT '',
    hit_points        TEXT   NOT NULL DEFAULT '',
    speed             TEXT   NOT NULL DEFAULT '',
    abilities         JSONB  NOT NULL DEFAULT '{}',
    misc              JSONB  NOT NULL DEFAULT '{}',
    actions           JSONB  NOT NULL DEFAULT '[]',
    search_vector     TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('russian', coalesce(name_ru, ''))
    ) STORED
);

CREATE INDEX idx_monsters_search  ON monsters USING GIN(search_vector);
CREATE INDEX idx_monsters_name_ru ON monsters(name_ru);
