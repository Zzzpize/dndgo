package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type NpcFolder struct {
	ID        uuid.UUID
	RoomID    uuid.UUID
	Name      string
	CreatedAt time.Time
}

func (s *Store) CreateNpcFolder(ctx context.Context, roomID uuid.UUID, name string) (NpcFolder, error) {
	var f NpcFolder
	err := s.pool.QueryRow(ctx,
		`INSERT INTO npc_folders (room_id, name) VALUES ($1, $2)
		 RETURNING id, room_id, name, created_at`,
		roomID, name,
	).Scan(&f.ID, &f.RoomID, &f.Name, &f.CreatedAt)
	return f, err
}

func (s *Store) GetNpcFoldersByRoom(ctx context.Context, roomID uuid.UUID) ([]NpcFolder, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, room_id, name, created_at FROM npc_folders WHERE room_id = $1 ORDER BY name`,
		roomID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []NpcFolder
	for rows.Next() {
		var f NpcFolder
		if err := rows.Scan(&f.ID, &f.RoomID, &f.Name, &f.CreatedAt); err != nil {
			return nil, err
		}
		folders = append(folders, f)
	}
	return folders, rows.Err()
}

func (s *Store) RenameNpcFolder(ctx context.Context, id uuid.UUID, name string) (NpcFolder, error) {
	var f NpcFolder
	err := s.pool.QueryRow(ctx,
		`UPDATE npc_folders SET name = $1 WHERE id = $2 RETURNING id, room_id, name, created_at`,
		name, id,
	).Scan(&f.ID, &f.RoomID, &f.Name, &f.CreatedAt)
	return f, err
}

func (s *Store) DeleteNpcFolder(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM npc_folders WHERE id = $1`, id)
	return err
}

func (s *Store) SetNPCFolder(ctx context.Context, npcID uuid.UUID, folderID *uuid.UUID) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE npcs SET folder_id = $1, updated_at = NOW() WHERE id = $2`,
		folderID, npcID,
	)
	return err
}
