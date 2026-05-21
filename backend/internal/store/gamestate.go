package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GameState struct {
	RoomID          uuid.UUID       `json:"room_id"`
	MapImageURL     string          `json:"map_image_url"`
	GridEnabled     bool            `json:"grid_enabled"`
	GridSize        int             `json:"grid_size"`
	FogCells        json.RawMessage `json:"fog_cells"`
	InitiativeOrder json.RawMessage `json:"initiative_order"`
}

type MapToken struct {
	ID          uuid.UUID  `json:"id"`
	RoomID      uuid.UUID  `json:"room_id"`
	TokenType   string     `json:"token_type"`
	CharacterID *uuid.UUID `json:"character_id,omitempty"`
	NpcID       *uuid.UUID `json:"npc_id,omitempty"`
	Name        string     `json:"name"`
	RelX        float64    `json:"rel_x"`
	RelY        float64    `json:"rel_y"`
	Disposition string     `json:"disposition"`
	CurrentHP   *int       `json:"current_hp,omitempty"`
	MaxHP       *int       `json:"max_hp,omitempty"`
}

type TokenInput struct {
	TokenType   string     `json:"token_type"`
	CharacterID *uuid.UUID `json:"character_id,omitempty"`
	NpcID       *uuid.UUID `json:"npc_id,omitempty"`
	Name        string     `json:"name"`
	RelX        float64    `json:"rel_x"`
	RelY        float64    `json:"rel_y"`
	Disposition string     `json:"disposition"`
	CurrentHP   *int       `json:"current_hp,omitempty"`
	MaxHP       *int       `json:"max_hp,omitempty"`
}

func (s *Store) GetGameState(ctx context.Context, roomID uuid.UUID) (GameState, error) {
	var gs GameState
	err := s.pool.QueryRow(ctx, `
		SELECT room_id, map_image_url, grid_enabled, grid_size, fog_cells, initiative_order
		FROM game_state WHERE room_id = $1`, roomID,
	).Scan(&gs.RoomID, &gs.MapImageURL, &gs.GridEnabled, &gs.GridSize, &gs.FogCells, &gs.InitiativeOrder)
	if err == pgx.ErrNoRows {
		return GameState{
			RoomID:          roomID,
			GridEnabled:     true,
			GridSize:        50,
			FogCells:        json.RawMessage("[]"),
			InitiativeOrder: json.RawMessage("[]"),
		}, nil
	}
	return gs, err
}

func (s *Store) UpsertGameState(ctx context.Context, gs GameState) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_state (room_id, map_image_url, grid_enabled, grid_size, fog_cells, initiative_order, updated_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
		ON CONFLICT (room_id) DO UPDATE SET
			map_image_url    = EXCLUDED.map_image_url,
			grid_enabled     = EXCLUDED.grid_enabled,
			grid_size        = EXCLUDED.grid_size,
			fog_cells        = EXCLUDED.fog_cells,
			initiative_order = EXCLUDED.initiative_order,
			updated_at       = NOW()`,
		gs.RoomID, gs.MapImageURL, gs.GridEnabled, gs.GridSize,
		string(gs.FogCells), string(gs.InitiativeOrder),
	)
	return err
}

func (s *Store) UpdateMapImageURL(ctx context.Context, roomID uuid.UUID, url string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_state (room_id, map_image_url, grid_enabled, grid_size, fog_cells, initiative_order, updated_at)
		VALUES ($1, $2, true, 50, '[]'::jsonb, '[]'::jsonb, NOW())
		ON CONFLICT (room_id) DO UPDATE SET
			map_image_url = EXCLUDED.map_image_url,
			updated_at    = NOW()`,
		roomID, url,
	)
	return err
}

const tokenCols = `id, room_id, token_type, character_id, npc_id, name, rel_x, rel_y, disposition, current_hp, max_hp`

func scanToken(row interface{ Scan(...any) error }) (MapToken, error) {
	var t MapToken
	err := row.Scan(&t.ID, &t.RoomID, &t.TokenType, &t.CharacterID, &t.NpcID,
		&t.Name, &t.RelX, &t.RelY, &t.Disposition, &t.CurrentHP, &t.MaxHP)
	return t, err
}

func (s *Store) GetTokensByRoom(ctx context.Context, roomID uuid.UUID) ([]MapToken, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+tokenCols+`
		FROM map_tokens WHERE room_id = $1 ORDER BY created_at`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []MapToken
	for rows.Next() {
		t, err := scanToken(rows)
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, t)
	}
	if tokens == nil {
		tokens = []MapToken{}
	}
	return tokens, rows.Err()
}

func (s *Store) CreateToken(ctx context.Context, roomID uuid.UUID, in TokenInput) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO map_tokens (room_id, token_type, character_id, npc_id, name, rel_x, rel_y, disposition, current_hp, max_hp)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+tokenCols,
		roomID, in.TokenType, in.CharacterID, in.NpcID, in.Name,
		in.RelX, in.RelY, in.Disposition, in.CurrentHP, in.MaxHP,
	)
	return scanToken(row)
}

func (s *Store) UpdateTokenPosition(ctx context.Context, tokenID uuid.UUID, relX, relY float64) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE map_tokens SET rel_x = $2, rel_y = $3
		WHERE id = $1
		RETURNING `+tokenCols,
		tokenID, relX, relY,
	)
	return scanToken(row)
}

func (s *Store) UpdateTokenHP(ctx context.Context, tokenID uuid.UUID, currentHP *int) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE map_tokens SET current_hp = $2
		WHERE id = $1
		RETURNING `+tokenCols,
		tokenID, currentHP,
	)
	return scanToken(row)
}

func (s *Store) DeleteToken(ctx context.Context, tokenID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM map_tokens WHERE id = $1`, tokenID)
	return err
}

func (s *Store) GetTokenByID(ctx context.Context, tokenID uuid.UUID) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+tokenCols+` FROM map_tokens WHERE id = $1`, tokenID)
	return scanToken(row)
}
