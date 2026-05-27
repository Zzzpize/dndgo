package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NPC struct {
	ID               uuid.UUID
	UserID           uuid.UUID
	RoomID           uuid.UUID
	FolderID         *uuid.UUID
	Name             string
	Disposition      string
	AC               string
	MaxHP            string
	Speed            string
	TypeAlignment    string
	Abilities        json.RawMessage
	Misc             json.RawMessage
	Actions          json.RawMessage
	Reactions        json.RawMessage
	BonusActions     json.RawMessage
	LegendaryActions json.RawMessage
	LairActions      json.RawMessage
	RegionalEffects  json.RawMessage
	MythicActions    json.RawMessage
	Size             int
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type NPCInput struct {
	FolderID         *uuid.UUID
	Name             string
	Disposition      string
	AC               string
	MaxHP            string
	Speed            string
	TypeAlignment    string
	Abilities        json.RawMessage
	Misc             json.RawMessage
	Actions          json.RawMessage
	Reactions        json.RawMessage
	BonusActions     json.RawMessage
	LegendaryActions json.RawMessage
	LairActions      json.RawMessage
	RegionalEffects  json.RawMessage
	MythicActions    json.RawMessage
	Size             int
}

const npcColumns = `id, user_id, room_id, folder_id, name, disposition, ac, max_hp, speed, type_alignment,
	abilities, misc, actions, reactions, bonus_actions, legendary_actions,
	lair_actions, regional_effects, mythic_actions, size,
	created_at, updated_at`

func scanNPC(row interface{ Scan(...any) error }) (NPC, error) {
	var n NPC
	err := row.Scan(
		&n.ID, &n.UserID, &n.RoomID, &n.FolderID,
		&n.Name, &n.Disposition, &n.AC, &n.MaxHP,
		&n.Speed, &n.TypeAlignment,
		&n.Abilities, &n.Misc, &n.Actions,
		&n.Reactions, &n.BonusActions, &n.LegendaryActions,
		&n.LairActions, &n.RegionalEffects, &n.MythicActions, &n.Size,
		&n.CreatedAt, &n.UpdatedAt,
	)
	return n, err
}

func (s *Store) CreateNPC(ctx context.Context, userID, roomID uuid.UUID, in NPCInput) (NPC, error) {
	size := in.Size
	if size < 1 {
		size = 1
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO npcs (
			user_id, room_id, folder_id, name, disposition, ac, max_hp, speed, type_alignment,
			abilities, misc, actions, reactions, bonus_actions, legendary_actions,
			lair_actions, regional_effects, mythic_actions, size
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb,
			$16::jsonb, $17::jsonb, $18::jsonb, $19
		) RETURNING `+npcColumns,
		userID, roomID, in.FolderID, in.Name, in.Disposition, in.AC, in.MaxHP,
		in.Speed, in.TypeAlignment,
		jsonOrEmpty(in.Abilities),
		jsonOrEmpty(in.Misc),
		jsonArrayOrEmpty(in.Actions),
		jsonArrayOrEmpty(in.Reactions),
		jsonArrayOrEmpty(in.BonusActions),
		jsonArrayOrEmpty(in.LegendaryActions),
		jsonArrayOrEmpty(in.LairActions),
		jsonArrayOrEmpty(in.RegionalEffects),
		jsonArrayOrEmpty(in.MythicActions),
		size,
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
	updSize := in.Size
	if updSize < 1 {
		updSize = 1
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE npcs SET
			folder_id=$1, name=$2, disposition=$3, ac=$4, max_hp=$5, speed=$6,
			type_alignment=$7,
			abilities=$8::jsonb, misc=$9::jsonb, actions=$10::jsonb,
			reactions=$11::jsonb, bonus_actions=$12::jsonb, legendary_actions=$13::jsonb,
			lair_actions=$14::jsonb, regional_effects=$15::jsonb, mythic_actions=$16::jsonb,
			size=$17, updated_at=NOW()
		WHERE id=$18
		RETURNING `+npcColumns,
		in.FolderID, in.Name, in.Disposition, in.AC, in.MaxHP, in.Speed,
		in.TypeAlignment,
		jsonOrEmpty(in.Abilities),
		jsonOrEmpty(in.Misc),
		jsonArrayOrEmpty(in.Actions),
		jsonArrayOrEmpty(in.Reactions),
		jsonArrayOrEmpty(in.BonusActions),
		jsonArrayOrEmpty(in.LegendaryActions),
		jsonArrayOrEmpty(in.LairActions),
		jsonArrayOrEmpty(in.RegionalEffects),
		jsonArrayOrEmpty(in.MythicActions),
		updSize,
		id,
	)
	return scanNPC(row)
}

func (s *Store) DeleteNPC(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM npcs WHERE id = $1`, id)
	return err
}
