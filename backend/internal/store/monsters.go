package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

type MonsterSummary struct {
	ID               int    `json:"id"`
	NameRu           string `json:"name_ru"`
	NameEn           string `json:"name_en"`
	TypeAndAlignment string `json:"type_and_alignment"`
	ArmorClass       string `json:"armor_class"`
	HitPoints        string `json:"hit_points"`
	Speed            string `json:"speed"`
}

type Monster struct {
	MonsterSummary
	Abilities json.RawMessage `json:"abilities"`
	Misc      json.RawMessage `json:"misc"`
	Actions   json.RawMessage `json:"actions"`
}

func (s *Store) CountMonsters(ctx context.Context, query string) (int64, error) {
	var count int64
	var err error
	if query == "" {
		err = s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM monsters`).Scan(&count)
	} else {
		err = s.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM monsters WHERE search_vector @@ plainto_tsquery('russian', $1)`,
			query,
		).Scan(&count)
	}
	return count, err
}

func (s *Store) ListMonsters(ctx context.Context, query string, limit, offset int) ([]MonsterSummary, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if query == "" {
		rows, err = s.pool.Query(ctx, `
			SELECT id, name_ru, name_en, type_and_alignment, armor_class, hit_points, speed
			FROM monsters ORDER BY name_ru LIMIT $1 OFFSET $2`,
			limit, offset,
		)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT id, name_ru, name_en, type_and_alignment, armor_class, hit_points, speed
			FROM monsters
			WHERE search_vector @@ plainto_tsquery('russian', $1)
			ORDER BY ts_rank(search_vector, plainto_tsquery('russian', $1)) DESC
			LIMIT $2 OFFSET $3`,
			query, limit, offset,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var monsters []MonsterSummary
	for rows.Next() {
		var m MonsterSummary
		if err := rows.Scan(&m.ID, &m.NameRu, &m.NameEn, &m.TypeAndAlignment, &m.ArmorClass, &m.HitPoints, &m.Speed); err != nil {
			return nil, err
		}
		monsters = append(monsters, m)
	}
	return monsters, rows.Err()
}

func (s *Store) GetMonsterByID(ctx context.Context, id int) (Monster, error) {
	var m Monster
	err := s.pool.QueryRow(ctx, `
		SELECT id, name_ru, name_en, type_and_alignment, armor_class, hit_points, speed,
		       abilities, misc, actions
		FROM monsters WHERE id = $1`, id,
	).Scan(
		&m.ID, &m.NameRu, &m.NameEn, &m.TypeAndAlignment, &m.ArmorClass, &m.HitPoints, &m.Speed,
		&m.Abilities, &m.Misc, &m.Actions,
	)
	return m, err
}
