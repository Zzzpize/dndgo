package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Character struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	RoomID     uuid.UUID
	Name       string
	Class      string
	Subclass   string
	Race       string
	Subrace    string
	Level      int
	HP         int
	MaxHP      int
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

type CharacterInput struct {
	Name       string
	Class      string
	Subclass   string
	Race       string
	Subrace    string
	Level      int
	HP         int
	MaxHP      int
	AC         int
	TempHP     int
	Stats      json.RawMessage
	Weapons    json.RawMessage
	SpellSlots json.RawMessage
	Abilities  json.RawMessage
	Inventory  string
	Notes      string
}

const characterColumns = `
	id, user_id, room_id, name, class, subclass, race, subrace, level, hp, max_hp, ac, temp_hp,
	stats, weapons, spell_slots, abilities, inventory, notes, created_at, updated_at`

func scanCharacter(row interface{ Scan(...any) error }) (Character, error) {
	var c Character
	err := row.Scan(
		&c.ID, &c.UserID, &c.RoomID,
		&c.Name, &c.Class, &c.Subclass, &c.Race, &c.Subrace,
		&c.Level, &c.HP, &c.MaxHP, &c.AC, &c.TempHP,
		&c.Stats, &c.Weapons, &c.SpellSlots, &c.Abilities,
		&c.Inventory, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
	)
	return c, err
}

func jsonOrEmpty(v json.RawMessage) string {
	if len(v) == 0 {
		return "{}"
	}
	return string(v)
}

func jsonArrayOrEmpty(v json.RawMessage) string {
	if len(v) == 0 {
		return "[]"
	}
	return string(v)
}

func (s *Store) CreateCharacter(ctx context.Context, userID, roomID uuid.UUID, in CharacterInput) (Character, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO characters (user_id, room_id, name, class, subclass, race, subrace, level, hp, max_hp, ac, temp_hp, stats, weapons, spell_slots, abilities, inventory, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17, $18)
		RETURNING `+characterColumns,
		userID, roomID, in.Name, in.Class, in.Subclass, in.Race, in.Subrace,
		in.Level, in.HP, in.MaxHP, in.AC, in.TempHP,
		jsonOrEmpty(in.Stats), jsonArrayOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots),
		jsonArrayOrEmpty(in.Abilities), in.Inventory, in.Notes,
	)
	return scanCharacter(row)
}

func (s *Store) GetCharactersByRoom(ctx context.Context, roomID uuid.UUID) ([]Character, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+characterColumns+`
		FROM characters WHERE room_id = $1
		ORDER BY name`,
		roomID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chars []Character
	for rows.Next() {
		c, err := scanCharacter(rows)
		if err != nil {
			return nil, err
		}
		chars = append(chars, c)
	}
	return chars, rows.Err()
}

func (s *Store) GetCharacterByID(ctx context.Context, id uuid.UUID) (Character, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+characterColumns+` FROM characters WHERE id = $1`, id)
	return scanCharacter(row)
}

func (s *Store) UpdateCharacter(ctx context.Context, id uuid.UUID, in CharacterInput) (Character, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE characters SET
			name=$1, class=$2, subclass=$3, race=$4, subrace=$5,
			level=$6, hp=$7, max_hp=$8, ac=$9, temp_hp=$10,
			stats=$11::jsonb, weapons=$12::jsonb, spell_slots=$13::jsonb, abilities=$14::jsonb,
			inventory=$15, notes=$16, updated_at=NOW()
		WHERE id=$17
		RETURNING `+characterColumns,
		in.Name, in.Class, in.Subclass, in.Race, in.Subrace,
		in.Level, in.HP, in.MaxHP, in.AC, in.TempHP,
		jsonOrEmpty(in.Stats), jsonArrayOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots),
		jsonArrayOrEmpty(in.Abilities), in.Inventory, in.Notes, id,
	)
	return scanCharacter(row)
}

func (s *Store) UpdateCharacterHP(ctx context.Context, id uuid.UUID, delta int) (Character, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE characters
		SET hp = GREATEST(0, LEAST(max_hp, hp + $1)), updated_at = NOW()
		WHERE id = $2
		RETURNING `+characterColumns,
		delta, id,
	)
	return scanCharacter(row)
}

func (s *Store) DeleteCharacter(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM characters WHERE id = $1`, id)
	return err
}

func (s *Store) GetMemberRoleByRoomID(ctx context.Context, roomID, userID uuid.UUID) (string, error) {
	var role string
	err := s.pool.QueryRow(ctx,
		`SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
		roomID, userID,
	).Scan(&role)
	return role, err
}
