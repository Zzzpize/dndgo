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
	Race       string
	Level      int
	HP         int
	MaxHP      int
	AC         int
	Stats      json.RawMessage
	Weapons    json.RawMessage
	SpellSlots json.RawMessage
	Notes      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type CharacterInput struct {
	Name       string
	Class      string
	Race       string
	Level      int
	HP         int
	MaxHP      int
	AC         int
	Stats      json.RawMessage
	Weapons    json.RawMessage
	SpellSlots json.RawMessage
	Notes      string
}

const characterColumns = `
	id, user_id, room_id, name, class, race, level, hp, max_hp, ac,
	stats, weapons, spell_slots, notes, created_at, updated_at`

func scanCharacter(row interface{ Scan(...any) error }) (Character, error) {
	var c Character
	err := row.Scan(
		&c.ID, &c.UserID, &c.RoomID,
		&c.Name, &c.Class, &c.Race,
		&c.Level, &c.HP, &c.MaxHP, &c.AC,
		&c.Stats, &c.Weapons, &c.SpellSlots,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
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
		INSERT INTO characters (user_id, room_id, name, class, race, level, hp, max_hp, ac, stats, weapons, spell_slots, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13)
		RETURNING `+characterColumns,
		userID, roomID, in.Name, in.Class, in.Race, in.Level,
		in.HP, in.MaxHP, in.AC,
		jsonOrEmpty(in.Stats), jsonOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots), in.Notes,
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
			name=$1, class=$2, race=$3, level=$4, hp=$5, max_hp=$6, ac=$7,
			stats=$8::jsonb, weapons=$9::jsonb, spell_slots=$10::jsonb, notes=$11,
			updated_at=NOW()
		WHERE id=$12
		RETURNING `+characterColumns,
		in.Name, in.Class, in.Race, in.Level, in.HP, in.MaxHP, in.AC,
		jsonOrEmpty(in.Stats), jsonArrayOrEmpty(in.Weapons), jsonOrEmpty(in.SpellSlots), in.Notes,
		id,
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
