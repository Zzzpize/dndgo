package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NPC struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	RoomID        uuid.UUID
	FolderID      *uuid.UUID
	Name          string
	Disposition   string
	AC            string
	MaxHP         int
	Speed         string
	TypeAlignment string
	Abilities     json.RawMessage
	Actions       json.RawMessage
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type NPCInput struct {
	FolderID      *uuid.UUID
	Name          string
	Disposition   string
	AC            string
	MaxHP         int
	Speed         string
	TypeAlignment string
	Abilities     json.RawMessage
	Actions       json.RawMessage
}

const npcColumns = `id, user_id, room_id, folder_id, name, disposition, ac, max_hp, speed, type_alignment, abilities, actions, created_at, updated_at`

func scanNPC(row interface{ Scan(...any) error }) (NPC, error) {
	var n NPC
	err := row.Scan(
		&n.ID, &n.UserID, &n.RoomID, &n.FolderID,
		&n.Name, &n.Disposition, &n.AC, &n.MaxHP,
		&n.Speed, &n.TypeAlignment,
		&n.Abilities, &n.Actions,
		&n.CreatedAt, &n.UpdatedAt,
	)
	return n, err
}

func (s *Store) CreateNPC(ctx context.Context, userID, roomID uuid.UUID, in NPCInput) (NPC, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO npcs (user_id, room_id, folder_id, name, disposition, ac, max_hp, speed, type_alignment, abilities, actions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
		RETURNING `+npcColumns,
		userID, roomID, in.FolderID, in.Name, in.Disposition, in.AC, in.MaxHP,
		in.Speed, in.TypeAlignment,
		jsonOrEmpty(in.Abilities), jsonArrayOrEmpty(in.Actions),
	)
	return scanNPC(row)
}

func (s *Store) GetNPCsByRoom(ctx context.Context, roomID uuid.UUID) ([]NPC, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+npcColumns+`
		FROM npcs WHERE room_id = $1
		ORDER BY name`, roomID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var npcs []NPC
	for rows.Next() {
		n, err := scanNPC(rows)
		if err != nil {
			return nil, err
		}
		npcs = append(npcs, n)
	}
	return npcs, rows.Err()
}

func (s *Store) GetNPCByID(ctx context.Context, id uuid.UUID) (NPC, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+npcColumns+` FROM npcs WHERE id = $1`, id)
	return scanNPC(row)
}

func (s *Store) UpdateNPC(ctx context.Context, id uuid.UUID, in NPCInput) (NPC, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE npcs SET
			folder_id=$1, name=$2, disposition=$3, ac=$4, max_hp=$5, speed=$6,
			type_alignment=$7, abilities=$8::jsonb, actions=$9::jsonb,
			updated_at=NOW()
		WHERE id=$10
		RETURNING `+npcColumns,
		in.FolderID, in.Name, in.Disposition, in.AC, in.MaxHP, in.Speed,
		in.TypeAlignment, jsonOrEmpty(in.Abilities), jsonArrayOrEmpty(in.Actions), id,
	)
	return scanNPC(row)
}

func (s *Store) DeleteNPC(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM npcs WHERE id = $1`, id)
	return err
}
