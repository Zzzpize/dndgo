package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type FogPath struct {
	RelX   float64 `json:"rel_x"`
	RelY   float64 `json:"rel_y"`
	Radius float64 `json:"radius"`
	Type   string  `json:"type,omitempty"`
}

type GameState struct {
	RoomID              uuid.UUID       `json:"room_id"`
	MapImageURL         string          `json:"map_image_url"`
	MapAspect           float64         `json:"map_aspect"`
	GridEnabled         bool            `json:"grid_enabled"`
	GridSize            int             `json:"grid_size"`
	FogPaths            json.RawMessage `json:"fog_paths"`
	FogCleared          bool            `json:"fog_cleared"`
	InitiativeOrder     json.RawMessage `json:"initiative_order"`
	CurrentInitIndex    int             `json:"current_init_index"`
	PlayerCanMoveToken  bool            `json:"player_can_move_token"`
	PlayerCanRevealFog  bool            `json:"player_can_reveal_fog"`
	PlayerCanEditToken  bool            `json:"player_can_edit_token"`
	PlayerCanEditHP     bool            `json:"player_can_edit_hp"`
	PlayerCanEditSheet  bool            `json:"player_can_edit_sheet"`
	PlayersSeesDMRolls  bool            `json:"players_see_dm_rolls"`
	PlayerCanRollDice   bool            `json:"player_can_roll_dice"`
	KarmicEnabled       bool            `json:"karmic_enabled"`
	KarmicMode          string          `json:"karmic_mode"`
	KarmicDMOnly        bool            `json:"karmic_dm_only"`
	KarmicOnlyD20       bool            `json:"karmic_only_d20"`
}

type RoomSettings struct {
	PlayerCanMoveToken bool   `json:"player_can_move_token"`
	PlayerCanRevealFog bool   `json:"player_can_reveal_fog"`
	PlayerCanEditToken bool   `json:"player_can_edit_token"`
	PlayerCanEditHP    bool   `json:"player_can_edit_hp"`
	PlayerCanEditSheet bool   `json:"player_can_edit_sheet"`
	PlayersSeesDMRolls bool   `json:"players_see_dm_rolls"`
	PlayerCanRollDice  bool   `json:"player_can_roll_dice"`
	KarmicEnabled      bool   `json:"karmic_enabled"`
	KarmicMode         string `json:"karmic_mode"`
	KarmicDMOnly       bool   `json:"karmic_dm_only"`
	KarmicOnlyD20      bool   `json:"karmic_only_d20"`
}

type MapToken struct {
	ID           uuid.UUID       `json:"id"`
	RoomID       uuid.UUID       `json:"room_id"`
	TokenType    string          `json:"token_type"`
	CharacterID  *uuid.UUID      `json:"character_id,omitempty"`
	NpcID        *uuid.UUID      `json:"npc_id,omitempty"`
	Name         string          `json:"name"`
	RelX         float64         `json:"rel_x"`
	RelY         float64         `json:"rel_y"`
	Disposition  string          `json:"disposition"`
	CurrentHP    *int            `json:"current_hp,omitempty"`
	MaxHP        *string         `json:"max_hp,omitempty"`
	TempHP       int             `json:"temp_hp"`
	Size         int             `json:"size"`
	NpcOverrides json.RawMessage `json:"npc_overrides,omitempty"`
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
	MaxHP       *string    `json:"max_hp,omitempty"`
	TempHP      int        `json:"temp_hp"`
	Size        int        `json:"size"`
}

func (s *Store) GetGameState(ctx context.Context, roomID uuid.UUID) (GameState, error) {
	var gs GameState
	err := s.pool.QueryRow(ctx, `
		SELECT room_id, map_image_url, map_aspect, grid_enabled, grid_size, fog_cells, fog_cleared, initiative_order,
		       current_init_index,
		       player_can_move_token, player_can_reveal_fog, player_can_edit_token,
		       player_can_edit_hp, player_can_edit_sheet, players_see_dm_rolls, player_can_roll_dice,
		       karmic_enabled, karmic_mode, karmic_dm_only, karmic_only_d20
		FROM game_state WHERE room_id = $1`, roomID,
	).Scan(
		&gs.RoomID, &gs.MapImageURL, &gs.MapAspect, &gs.GridEnabled, &gs.GridSize,
		&gs.FogPaths, &gs.FogCleared, &gs.InitiativeOrder,
		&gs.CurrentInitIndex,
		&gs.PlayerCanMoveToken, &gs.PlayerCanRevealFog, &gs.PlayerCanEditToken,
		&gs.PlayerCanEditHP, &gs.PlayerCanEditSheet, &gs.PlayersSeesDMRolls, &gs.PlayerCanRollDice,
		&gs.KarmicEnabled, &gs.KarmicMode, &gs.KarmicDMOnly, &gs.KarmicOnlyD20,
	)
	if err == pgx.ErrNoRows {
		return GameState{
			RoomID:             roomID,
			MapAspect:          1,
			GridEnabled:        true,
			GridSize:           50,
			FogPaths:           json.RawMessage("[]"),
			FogCleared:         true,
			InitiativeOrder:    json.RawMessage("[]"),
			CurrentInitIndex:   0,
			PlayerCanMoveToken: true,
			PlayerCanRevealFog: true,
			PlayerCanEditToken: true,
			PlayerCanEditHP:    true,
			PlayerCanEditSheet: true,
			PlayersSeesDMRolls: true,
			PlayerCanRollDice:  true,
			KarmicEnabled:      false,
			KarmicMode:         "protection",
			KarmicDMOnly:       false,
			KarmicOnlyD20:      false,
		}, nil
	}
	return gs, err
}

func (s *Store) UpdateRoomSettings(ctx context.Context, roomID uuid.UUID, settings RoomSettings) error {
	mode := settings.KarmicMode
	if mode != "protection" && mode != "balanced" {
		mode = "protection"
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_state
			(room_id, map_image_url, map_aspect, grid_enabled, grid_size, fog_cells, fog_cleared, initiative_order,
			 player_can_move_token, player_can_reveal_fog, player_can_edit_token,
			 player_can_edit_hp, player_can_edit_sheet, players_see_dm_rolls, player_can_roll_dice,
			 karmic_enabled, karmic_mode, karmic_dm_only, karmic_only_d20, updated_at)
		VALUES ($1, '', 1, true, 50, '[]'::jsonb, true, '[]'::jsonb, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
		ON CONFLICT (room_id) DO UPDATE SET
			player_can_move_token = EXCLUDED.player_can_move_token,
			player_can_reveal_fog = EXCLUDED.player_can_reveal_fog,
			player_can_edit_token = EXCLUDED.player_can_edit_token,
			player_can_edit_hp    = EXCLUDED.player_can_edit_hp,
			player_can_edit_sheet = EXCLUDED.player_can_edit_sheet,
			players_see_dm_rolls  = EXCLUDED.players_see_dm_rolls,
			player_can_roll_dice  = EXCLUDED.player_can_roll_dice,
			karmic_enabled        = EXCLUDED.karmic_enabled,
			karmic_mode           = EXCLUDED.karmic_mode,
			karmic_dm_only        = EXCLUDED.karmic_dm_only,
			karmic_only_d20       = EXCLUDED.karmic_only_d20,
			updated_at            = NOW()`,
		roomID,
		settings.PlayerCanMoveToken, settings.PlayerCanRevealFog, settings.PlayerCanEditToken,
		settings.PlayerCanEditHP, settings.PlayerCanEditSheet, settings.PlayersSeesDMRolls,
		settings.PlayerCanRollDice,
		settings.KarmicEnabled, mode, settings.KarmicDMOnly, settings.KarmicOnlyD20,
	)
	return err
}

func (s *Store) UpsertGameState(ctx context.Context, gs GameState) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_state (room_id, map_image_url, map_aspect, grid_enabled, grid_size, fog_cells, fog_cleared, initiative_order, current_init_index, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, NOW())
		ON CONFLICT (room_id) DO UPDATE SET
			map_image_url      = EXCLUDED.map_image_url,
			map_aspect         = EXCLUDED.map_aspect,
			grid_enabled       = EXCLUDED.grid_enabled,
			grid_size          = EXCLUDED.grid_size,
			fog_cells          = EXCLUDED.fog_cells,
			fog_cleared        = EXCLUDED.fog_cleared,
			initiative_order   = EXCLUDED.initiative_order,
			current_init_index = EXCLUDED.current_init_index,
			updated_at         = NOW()`,
		gs.RoomID, gs.MapImageURL, gs.MapAspect, gs.GridEnabled, gs.GridSize,
		string(gs.FogPaths), gs.FogCleared, string(gs.InitiativeOrder), gs.CurrentInitIndex,
	)
	return err
}

func (s *Store) UpdateMapImageURL(ctx context.Context, roomID uuid.UUID, url string, aspect float64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO game_state (room_id, map_image_url, map_aspect, grid_enabled, grid_size, fog_cells, fog_cleared, initiative_order, updated_at)
		VALUES ($1, $2, $3, true, 50, '[]'::jsonb, false, '[]'::jsonb, NOW())
		ON CONFLICT (room_id) DO UPDATE SET
			map_image_url = EXCLUDED.map_image_url,
			map_aspect    = EXCLUDED.map_aspect,
			fog_cells     = '[]'::jsonb,
			fog_cleared   = false,
			updated_at    = NOW()`,
		roomID, url, aspect,
	)
	return err
}

const tokenCols = `id, room_id, token_type, character_id, npc_id, name, rel_x, rel_y, disposition, current_hp, max_hp, temp_hp, size, npc_overrides`

func scanToken(row interface{ Scan(...any) error }) (MapToken, error) {
	var t MapToken
	err := row.Scan(&t.ID, &t.RoomID, &t.TokenType, &t.CharacterID, &t.NpcID,
		&t.Name, &t.RelX, &t.RelY, &t.Disposition, &t.CurrentHP, &t.MaxHP, &t.TempHP, &t.Size,
		&t.NpcOverrides)
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
	size := in.Size
	if size < 1 {
		size = 1
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO map_tokens (room_id, token_type, character_id, npc_id, name, rel_x, rel_y, disposition, current_hp, max_hp, temp_hp, size)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+tokenCols,
		roomID, in.TokenType, in.CharacterID, in.NpcID, in.Name,
		in.RelX, in.RelY, in.Disposition, in.CurrentHP, in.MaxHP, in.TempHP, size,
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

func (s *Store) UpdateTokenHP(ctx context.Context, tokenID uuid.UUID, currentHP *int, tempHP int) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE map_tokens SET current_hp = $2, temp_hp = $3
		WHERE id = $1
		RETURNING `+tokenCols,
		tokenID, currentHP, tempHP,
	)
	return scanToken(row)
}

func (s *Store) UpdateToken(ctx context.Context, tokenID uuid.UUID, name, disposition string, maxHP *string, currentHP *int, tempHP, size int, npcOverrides json.RawMessage) (MapToken, error) {
	if size < 1 {
		size = 1
	}
	var overrides any
	if len(npcOverrides) > 0 {
		overrides = string(npcOverrides)
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE map_tokens SET name = $2, disposition = $3, max_hp = $4, current_hp = $5, temp_hp = $6, size = $7, npc_overrides = $8::jsonb
		WHERE id = $1
		RETURNING `+tokenCols,
		tokenID, name, disposition, maxHP, currentHP, tempHP, size, overrides,
	)
	return scanToken(row)
}

func (s *Store) DeleteToken(ctx context.Context, tokenID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM map_tokens WHERE id = $1`, tokenID)
	return err
}

func (s *Store) DeleteAllTokensByRoom(ctx context.Context, roomID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM map_tokens WHERE room_id = $1`, roomID)
	return err
}

func (s *Store) GetTokenByID(ctx context.Context, tokenID uuid.UUID) (MapToken, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+tokenCols+` FROM map_tokens WHERE id = $1`, tokenID)
	return scanToken(row)
}
