package events

import (
	"encoding/json"
	"time"
)

const Topic = "game-events"

type GameEvent struct {
	EventID    string          `json:"event_id"`
	RoomID     string          `json:"room_id"`
	EventType  string          `json:"event_type"`
	UserID     string          `json:"user_id"`
	Payload    json.RawMessage `json:"payload"`
	OccurredAt time.Time       `json:"occurred_at"`
}

func Marshal(e *GameEvent) ([]byte, error) {
	return json.Marshal(e)
}

func Unmarshal(data []byte) (*GameEvent, error) {
	var e GameEvent
	return &e, json.Unmarshal(data, &e)
}
