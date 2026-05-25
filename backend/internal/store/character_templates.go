package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type CharacterTemplate struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Name       string
	Class      string
	Subclass   string
	Race       string
	Subrace    string
	Level      int
	HP         int
	MaxHP      string
	AC         int
	TempHP     int
	Stats      json.RawMessage
	Weapons    json.RawMessage
	SpellSlots json.RawMessage
	Abilities  json.RawMessage
	Inventory  string
	Notes      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

const templateColumns = `
	id, user_id, name, class, subclass, race, subrace, level, hp, max_hp, ac, temp_hp,
	stats, weapons, spell_slots, abilities, inventory, notes, created_at, updated_at`

func scanTemplate(row interface{ Scan(...any) error }) (CharacterTemplate, error) {
	var t CharacterTemplate
	err := row.Scan(
		&t.ID, &t.UserID,
		&t.Name, &t.Class, &t.Subclass, &t.Race, &t.Subrace,
		&t.Level, &t.HP, &t.MaxHP, &t.AC, &t.TempHP,
		&t.Stats, &t.Weapons, &t.SpellSlots, &t.Abilities,
		&t.Inventory, &t.Notes, &t.CreatedAt, &t.UpdatedAt,
	)
	return t, err
}

func (s *Store) GetTemplatesByUser(ctx context.Context, userID uuid.UUID) ([]CharacterTemplate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+templateColumns+`
		FROM character_templates WHERE user_id = $1
		ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []CharacterTemplate
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, rows.Err()
}

func (s *Store) CreateTemplate(ctx context.Context, userID uuid.UUID, in CharacterInput) (CharacterTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO character_templates
			(user_id, name, class, subclass, race, subrace, level, hp, max_hp, ac, temp_hp,
			 stats, weapons, spell_slots, abilities, inventory, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17)
		RETURNING `+templateColumns,
		userID, in.Name, in.Class, in.Subclass, in.Race, in.Subrace,
		in.Level, in.HP, in.MaxHP, in.AC, in.TempHP,
		jsonOrEmpty(in.Stats), jsonArrayOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots),
		jsonArrayOrEmpty(in.Abilities), in.Inventory, in.Notes,
	)
	return scanTemplate(row)
}

func (s *Store) GetTemplateByID(ctx context.Context, id uuid.UUID) (CharacterTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+templateColumns+` FROM character_templates WHERE id = $1`, id)
	return scanTemplate(row)
}

func (s *Store) UpdateTemplate(ctx context.Context, id uuid.UUID, in CharacterInput) (CharacterTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE character_templates SET
			name=$1, class=$2, subclass=$3, race=$4, subrace=$5,
			level=$6, hp=$7, max_hp=$8, ac=$9, temp_hp=$10,
			stats=$11::jsonb, weapons=$12::jsonb, spell_slots=$13::jsonb, abilities=$14::jsonb,
			inventory=$15, notes=$16, updated_at=NOW()
		WHERE id=$17
		RETURNING `+templateColumns,
		in.Name, in.Class, in.Subclass, in.Race, in.Subrace,
		in.Level, in.HP, in.MaxHP, in.AC, in.TempHP,
		jsonOrEmpty(in.Stats), jsonArrayOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots),
		jsonArrayOrEmpty(in.Abilities), in.Inventory, in.Notes, id,
	)
	return scanTemplate(row)
}

func (s *Store) DeleteTemplate(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM character_templates WHERE id = $1`, id)
	return err
}

func (s *Store) GetTemplateByUserAndName(ctx context.Context, userID uuid.UUID, name string) (CharacterTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+templateColumns+` FROM character_templates
		WHERE user_id = $1 AND name = $2`, userID, name)
	return scanTemplate(row)
}
