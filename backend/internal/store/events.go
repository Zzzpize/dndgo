package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type GameEvent struct {
	ID        uuid.UUID       `json:"id"`
	RoomID    uuid.UUID       `json:"room_id"`
	EventType string          `json:"event_type"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
}

func (s *Store) InsertGameEvent(ctx context.Context, roomID uuid.UUID, eventType string, payload json.RawMessage, occurredAt time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_events (room_id, event_type, payload, created_at)
		VALUES ($1, $2, $3::jsonb, $4)`,
		roomID, eventType, string(payload), occurredAt,
	)
	return err
}

func (s *Store) GetGameEvents(ctx context.Context, roomID uuid.UUID, limit int, before time.Time) ([]GameEvent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, room_id, event_type, payload, created_at
		FROM game_events
		WHERE room_id = $1 AND created_at < $2
		ORDER BY created_at DESC
		LIMIT $3`,
		roomID, before, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []GameEvent
	for rows.Next() {
		var ev GameEvent
		if err := rows.Scan(&ev.ID, &ev.RoomID, &ev.EventType, &ev.Payload, &ev.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, ev)
	}
	if result == nil {
		result = []GameEvent{}
	}
	return result, rows.Err()
}
