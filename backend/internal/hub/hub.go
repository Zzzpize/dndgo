package hub

import (
	"context"
	"encoding/json"
	"log"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/zzzpize/dndgo/backend/internal/store"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 50 * time.Second
	maxMessageSize = 64 * 1024
)

const (
	EvTokenCreate    = "TOKEN_CREATE"
	EvTokenMove      = "TOKEN_MOVE"
	EvTokenDrag      = "TOKEN_DRAG"
	EvTokenUpdate    = "TOKEN_UPDATE"
	EvTokenEdit      = "TOKEN_EDIT"
	EvTokenDelete    = "TOKEN_DELETE"
	EvDiceRoll       = "DICE_ROLL"
	EvDiceRollResult = "DICE_ROLL_RESULT"
	EvDiceLogClear   = "DICE_LOG_CLEAR"
	EvGridUpdate     = "GRID_UPDATE"
	EvFogReveal      = "FOG_REVEAL"
	EvFogHide        = "FOG_HIDE"
	EvFogClear       = "FOG_CLEAR"
	EvFogFill        = "FOG_FILL"
	EvInitUpdate     = "INIT_UPDATE"
	EvInitNext       = "INIT_NEXT"
	EvInitEnd        = "INIT_END"
	EvRulerUpdate    = "RULER_UPDATE"
	EvFullState      = "FULL_STATE_UPDATE"
	EvMapUpdate      = "MAP_UPDATE"
	EvCharUpdate     = "CHARACTER_UPDATE"
	EvMapClear       = "MAP_CLEAR"
	EvSessionClear   = "SESSION_CLEAR"
	EvDmPresence     = "DM_PRESENCE"
	EvSettingsUpdate = "SETTINGS_UPDATE"
)

type karmaState struct {
	bad  map[int]int
	good map[int]int
}

func newKarmaState() *karmaState {
	return &karmaState{bad: map[int]int{}, good: map[int]int{}}
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	conn     *websocket.Conn
	send     chan []byte
	userID   uuid.UUID
	username string
	role     string
	room     *Room
}

type Room struct {
	code        string
	clients     map[*Client]struct{}
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
	karmaMu     sync.Mutex
	playerKarma map[uuid.UUID]*karmaState
}

type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
	store *store.Store
}

func NewHub(st *store.Store) *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
		store: st,
	}
}

func (h *Hub) publish(ctx context.Context, _ uuid.UUID, roomID uuid.UUID, evType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	if err := h.store.InsertGameEvent(ctx, roomID, evType, json.RawMessage(data), time.Now()); err != nil {
		log.Printf("hub: insert event: %v", err)
	}
}

func (h *Hub) getOrCreateRoom(code string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.rooms[code]
	if !ok {
		r = &Room{
			code:        code,
			clients:     make(map[*Client]struct{}),
			broadcast:   make(chan []byte, 256),
			register:    make(chan *Client),
			unregister:  make(chan *Client),
			playerKarma: make(map[uuid.UUID]*karmaState),
		}
		h.rooms[code] = r
		go r.run()
	}
	return r
}

func (r *Room) notifyDmPresence() {
	r.mu.RLock()
	defer r.mu.RUnlock()
	dmOnline := false
	for c := range r.clients {
		if c.role == "dm" {
			dmOnline = true
			break
		}
	}
	data, _ := json.Marshal(map[string]bool{"online": dmOnline})
	msg, _ := json.Marshal(Message{Type: EvDmPresence, Payload: json.RawMessage(data)})
	for c := range r.clients {
		select {
		case c.send <- msg:
		default:
		}
	}
}

func (r *Room) run() {
	for {
		select {
		case c := <-r.register:
			r.mu.Lock()
			r.clients[c] = struct{}{}
			r.mu.Unlock()
			go r.notifyDmPresence()

		case c := <-r.unregister:
			r.mu.Lock()
			if _, ok := r.clients[c]; ok {
				delete(r.clients, c)
				close(c.send)
			}
			r.mu.Unlock()
			go r.notifyDmPresence()

		case msg := <-r.broadcast:
			r.mu.RLock()
			for c := range r.clients {
				select {
				case c.send <- msg:
				default:
				}
			}
			r.mu.RUnlock()
		}
	}
}

func (h *Hub) AddClient(c *Client, code string) {
	room := h.getOrCreateRoom(code)
	c.room = room
	room.register <- c
}

func (h *Hub) RemoveClient(c *Client) {
	if c.room != nil {
		c.room.unregister <- c
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) readPump(c *Client, roomID uuid.UUID) {
	defer func() {
		h.RemoveClient(c)
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		h.handleMessage(c, roomID, msg)
	}
}

func (h *Hub) handleMessage(c *Client, roomID uuid.UUID, msg Message) {
	ctx := context.Background()

	switch msg.Type {
	case EvDiceRoll:
		h.handleDiceRoll(ctx, c, roomID, msg.Payload)

	case EvDiceLogClear:
		if c.role != "dm" {
			return
		}
		h.broadcastToRoom(c.room, EvDiceLogClear, nil)

	case EvTokenCreate:
		if c.role != "dm" {
			return
		}
		var in store.TokenInput
		if err := json.Unmarshal(msg.Payload, &in); err != nil {
			return
		}
		token, err := h.store.CreateToken(ctx, roomID, in)
		if err != nil {
			log.Printf("hub: create token: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvTokenCreate, token)
		h.publish(ctx, c.userID, roomID, EvTokenCreate, token)

	case EvTokenMove:
		var p struct {
			ID   uuid.UUID `json:"id"`
			RelX float64   `json:"rel_x"`
			RelY float64   `json:"rel_y"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		if c.role != "dm" {
			existing, err := h.store.GetTokenByID(ctx, p.ID)
			if err != nil || existing.TokenType != "pc" {
				return
			}
		}
		token, err := h.store.UpdateTokenPosition(ctx, p.ID, p.RelX, p.RelY)
		if err != nil {
			log.Printf("hub: move token: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvTokenMove, token)
		h.publish(ctx, c.userID, roomID, EvTokenMove, token)

	case EvTokenDrag:
		var p struct {
			ID   uuid.UUID `json:"id"`
			RelX float64   `json:"rel_x"`
			RelY float64   `json:"rel_y"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		h.broadcastToRoomExcept(c.room, c, EvTokenDrag, map[string]any{
			"id":    p.ID.String(),
			"rel_x": p.RelX,
			"rel_y": p.RelY,
		})

	case EvTokenDelete:
		if c.role != "dm" {
			return
		}
		var p struct {
			ID uuid.UUID `json:"id"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		if err := h.store.DeleteToken(ctx, p.ID); err != nil {
			log.Printf("hub: delete token: %v", err)
			return
		}
		payload := map[string]string{"id": p.ID.String()}
		h.broadcastToRoom(c.room, EvTokenDelete, payload)
		h.publish(ctx, c.userID, roomID, EvTokenDelete, payload)

		// Remove deleted token from initiative order if present
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		var order []json.RawMessage
		if err := json.Unmarshal(gs.InitiativeOrder, &order); err != nil || len(order) == 0 {
			return
		}
		tokenIDStr := p.ID.String()
		deletedIdx := -1
		for i, entry := range order {
			var e struct {
				TokenID string `json:"token_id"`
			}
			if json.Unmarshal(entry, &e) == nil && e.TokenID == tokenIDStr {
				deletedIdx = i
				break
			}
		}
		if deletedIdx < 0 {
			return
		}
		newOrder := append(append([]json.RawMessage{}, order[:deletedIdx]...), order[deletedIdx+1:]...)
		if len(newOrder) == 0 {
			gs.InitiativeOrder = json.RawMessage("[]")
			gs.CurrentInitIndex = 0
			if upsertErr := h.store.UpsertGameState(ctx, gs); upsertErr != nil {
				log.Printf("hub: token delete initiative clear: %v", upsertErr)
			}
			h.broadcastToRoom(c.room, EvInitEnd, []struct{}{})
			return
		}
		newIdx := gs.CurrentInitIndex
		if deletedIdx < gs.CurrentInitIndex {
			newIdx = gs.CurrentInitIndex - 1
		} else if deletedIdx == gs.CurrentInitIndex {
			newIdx = gs.CurrentInitIndex % len(newOrder)
		}
		newOrderData, _ := json.Marshal(newOrder)
		gs.InitiativeOrder = json.RawMessage(newOrderData)
		gs.CurrentInitIndex = newIdx
		if upsertErr := h.store.UpsertGameState(ctx, gs); upsertErr != nil {
			log.Printf("hub: token delete initiative update: %v", upsertErr)
			return
		}
		h.broadcastToRoom(c.room, EvInitUpdate, newOrder)
		h.broadcastToRoom(c.room, EvInitNext, map[string]any{"index": newIdx})

	case EvGridUpdate:
		if c.role != "dm" {
			return
		}
		var p struct {
			GridEnabled bool `json:"grid_enabled"`
			GridSize    int  `json:"grid_size"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.GridEnabled = p.GridEnabled
		gs.GridSize = p.GridSize
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: grid update: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvGridUpdate, p)

	case EvFogReveal:
		var newPaths []store.FogPath
		if err := json.Unmarshal(msg.Payload, &newPaths); err != nil {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		if gs.FogCleared {
			return
		}
		var existing []store.FogPath
		if len(gs.FogPaths) > 0 {
			json.Unmarshal(gs.FogPaths, &existing) //nolint:errcheck
		}
		merged := append(existing, newPaths...)
		data, _ := json.Marshal(merged)
		gs.FogPaths = json.RawMessage(data)
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: fog reveal: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvFogReveal, newPaths)

	case EvFogHide:
		if c.role != "dm" {
			return
		}
		var newPaths []store.FogPath
		if err := json.Unmarshal(msg.Payload, &newPaths); err != nil {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		if gs.FogCleared {
			return
		}
		var existing []store.FogPath
		if len(gs.FogPaths) > 0 {
			json.Unmarshal(gs.FogPaths, &existing) //nolint:errcheck
		}
		merged := append(existing, newPaths...)
		data, _ := json.Marshal(merged)
		gs.FogPaths = json.RawMessage(data)
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: fog hide: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvFogHide, newPaths)

	case EvFogFill:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.FogPaths = json.RawMessage("[]")
		gs.FogCleared = false
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: fog fill: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvFogFill, nil)

	case EvFogClear:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.FogPaths = json.RawMessage("[]")
		gs.FogCleared = true
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: fog clear: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvFogClear, nil)

	case EvInitUpdate:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		var newOrder []json.RawMessage
		_ = json.Unmarshal(msg.Payload, &newOrder)
		gs.InitiativeOrder = msg.Payload
		adjustedIdx := gs.CurrentInitIndex
		if len(newOrder) == 0 || adjustedIdx >= len(newOrder) {
			adjustedIdx = 0
		}
		gs.CurrentInitIndex = adjustedIdx
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: initiative update: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvInitUpdate, msg.Payload)
		h.broadcastToRoom(c.room, EvInitNext, map[string]any{"index": adjustedIdx})
		h.publish(ctx, c.userID, roomID, EvInitUpdate, msg.Payload)

	case EvInitNext:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		var order []json.RawMessage
		if err := json.Unmarshal(gs.InitiativeOrder, &order); err != nil || len(order) == 0 {
			return
		}
		newIdx := (gs.CurrentInitIndex + 1) % len(order)
		gs.CurrentInitIndex = newIdx
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: init next: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvInitNext, map[string]any{"index": newIdx})

	case EvInitEnd:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.InitiativeOrder = json.RawMessage("[]")
		gs.CurrentInitIndex = 0
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: init end: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvInitEnd, []struct{}{})

	case EvTokenUpdate:
		if c.role != "dm" {
			return
		}
		var p struct {
			ID        uuid.UUID `json:"id"`
			CurrentHP *int      `json:"current_hp"`
			TempHP    int       `json:"temp_hp"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		token, err := h.store.UpdateTokenHP(ctx, p.ID, p.CurrentHP, p.TempHP)
		if err != nil {
			log.Printf("hub: update token hp: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvTokenUpdate, token)

	case EvTokenEdit:
		if c.role != "dm" {
			return
		}
		var p struct {
			ID           uuid.UUID       `json:"id"`
			Name         string          `json:"name"`
			Disposition  string          `json:"disposition"`
			MaxHP        *string         `json:"max_hp"`
			CurrentHP    *int            `json:"current_hp"`
			TempHP       int             `json:"temp_hp"`
			Size         int             `json:"size"`
			NpcOverrides json.RawMessage `json:"npc_overrides"`
		}
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		token, err := h.store.UpdateToken(ctx, p.ID, p.Name, p.Disposition, p.MaxHP, p.CurrentHP, p.TempHP, p.Size, p.NpcOverrides)
		if err != nil {
			log.Printf("hub: edit token: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvTokenUpdate, token)

	case EvCharUpdate:
		h.broadcastToRoom(c.room, EvCharUpdate, msg.Payload)

	case EvRulerUpdate:
		h.broadcastToRoom(c.room, EvRulerUpdate, msg.Payload)

	case EvMapUpdate:
		if c.role != "dm" {
			return
		}
		h.broadcastToRoom(c.room, EvMapUpdate, msg.Payload)
		h.publish(ctx, c.userID, roomID, EvMapUpdate, msg.Payload)

	case EvMapClear:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			log.Printf("hub: map clear: get state: %v", err)
			return
		}
		gs.MapImageURL = ""
		gs.FogPaths = json.RawMessage("[]")
		gs.FogCleared = true
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: map clear: upsert: %v", err)
			return
		}
		tokens, _ := h.store.GetTokensByRoom(ctx, roomID)
		h.broadcastToRoom(c.room, EvFullState, map[string]any{"game_state": gs, "tokens": tokens})

	case EvSettingsUpdate:
		if c.role != "dm" {
			return
		}
		var settings store.RoomSettings
		if err := json.Unmarshal(msg.Payload, &settings); err != nil {
			return
		}
		if err := h.store.UpdateRoomSettings(ctx, roomID, settings); err != nil {
			log.Printf("hub: settings update: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvSettingsUpdate, settings)

	case EvSessionClear:
		if c.role != "dm" {
			return
		}
		if err := h.store.DeleteAllTokensByRoom(ctx, roomID); err != nil {
			log.Printf("hub: session clear: delete tokens: %v", err)
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			log.Printf("hub: session clear: get state: %v", err)
			return
		}
		gs.MapImageURL = ""
		gs.FogPaths = json.RawMessage("[]")
		gs.FogCleared = true
		gs.InitiativeOrder = json.RawMessage("[]")
		gs.CurrentInitIndex = 0
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: session clear: upsert: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvFullState, map[string]any{"game_state": gs, "tokens": []struct{}{}})
	}
}

type diceRollPayload struct {
	Notation string `json:"notation"`
}

func (h *Hub) handleDiceRoll(ctx context.Context, c *Client, roomID uuid.UUID, payload json.RawMessage) {
	var p diceRollPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}

	total, rolls, karmicApplied := h.karmicRoll(ctx, c, roomID, p.Notation)

	result := map[string]any{
		"user_id":        c.userID.String(),
		"username":       c.username,
		"role":           c.role,
		"notation":       p.Notation,
		"rolls":          rolls,
		"total":          total,
		"karmic_applied": karmicApplied,
	}
	h.broadcastToRoom(c.room, EvDiceRollResult, result)
	h.publish(ctx, c.userID, roomID, EvDiceRollResult, result)
}

// karmicRoll implements the Karmic Dice v1.1 algorithm.
// For single-die rolls it may bias the RNG based on the player's recent history.
// For multi-die formulas (n > 1) or d4, it falls back to plain rollDice.
func (h *Hub) karmicRoll(ctx context.Context, c *Client, roomID uuid.UUID, notation string) (int, []int, bool) {
	n, m, bonus, ok := parseDiceNotation(notation)
	if !ok {
		total, rolls := rollDice(notation)
		return total, rolls, false
	}

	// Karma only ever applies to single-die rolls and to d6/d8/d10/d12/d20.
	// d4 is excluded because its range is too small (per spec).
	singleEligibleDie := n == 1 && (m == 6 || m == 8 || m == 10 || m == 12 || m == 20)

	if !singleEligibleDie {
		total, rolls := rollDice(notation)
		return total, rolls, false
	}

	gs, err := h.store.GetGameState(ctx, roomID)
	if err != nil || !gs.KarmicEnabled {
		total, rolls := rollDice(notation)
		return total, rolls, false
	}

	isDM := c.role == "dm"
	if gs.KarmicDMOnly && !isDM {
		total, rolls := rollDice(notation)
		return total, rolls, false
	}
	if gs.KarmicOnlyD20 && m != 20 {
		total, rolls := rollDice(notation)
		return total, rolls, false
	}

	c.room.karmaMu.Lock()
	defer c.room.karmaMu.Unlock()

	ks := c.room.playerKarma[c.userID]
	if ks == nil {
		ks = newKarmaState()
		c.room.playerKarma[c.userID] = ks
	}

	sBad := ks.bad[m]
	sGood := ks.good[m]

	// Determine roll bounds from the current counters.
	minVal, maxVal := karmicBounds(m, sBad, sGood, gs.KarmicMode)

	// Roll with bounds; cap retries to avoid a pathological infinite loop.
	raw := rand.IntN(m) + 1
	for retries := 0; (raw < minVal || raw > maxVal) && retries < 32; retries++ {
		raw = rand.IntN(m) + 1
	}
	karmicApplied := minVal > 1 || maxVal < m

	// Update counters based on the RAW value (bonus is not considered).
	updateKarmicCounters(ks, m, raw, gs.KarmicMode)

	return raw + bonus, []int{raw}, karmicApplied
}

// karmicBounds returns the [min, max] range the RNG must fall into.
// Bad-luck protection tightens the lower bound; balanced mode (d20 only)
// tightens the upper bound on success streaks.
func karmicBounds(m, sBad, sGood int, mode string) (int, int) {
	minVal, maxVal := 1, m
	switch m {
	case 20:
		switch {
		case sBad >= 4:
			minVal = 10
		case sBad == 3:
			minVal = 8
		case sBad == 2:
			minVal = 5
		}
		if mode == "balanced" {
			switch {
			case sGood >= 3:
				maxVal = 13
			case sGood == 2:
				maxVal = 16
			}
		}
	case 12:
		switch {
		case sBad >= 3:
			minVal = 5
		case sBad == 2:
			minVal = 3
		}
	case 10:
		switch {
		case sBad >= 3:
			minVal = 4
		case sBad == 2:
			minVal = 2
		}
	case 8:
		switch {
		case sBad >= 3:
			minVal = 3
		case sBad == 2:
			minVal = 2
		}
	case 6:
		// d6: both thresholds use min=2 (reroll of 1s).
		if sBad >= 2 {
			minVal = 2
		}
	}
	return minVal, maxVal
}

// updateKarmicCounters increments/resets counters based on the raw die result.
// Thresholds are per-die-type (spec §3).
func updateKarmicCounters(ks *karmaState, m, raw int, mode string) {
	switch m {
	case 20:
		if raw <= 7 {
			ks.bad[m]++
		} else if raw >= 10 {
			ks.bad[m] = 0
		}
		if mode == "balanced" {
			if raw >= 15 {
				ks.good[m]++
				ks.bad[m] = 0
			} else if raw <= 10 {
				ks.good[m] = 0
			}
		}
	case 12:
		if raw <= 4 {
			ks.bad[m]++
		} else if raw >= 6 {
			ks.bad[m] = 0
		}
	case 10:
		if raw <= 3 {
			ks.bad[m]++
		} else if raw >= 5 {
			ks.bad[m] = 0
		}
	case 8:
		if raw <= 2 {
			ks.bad[m]++
		} else if raw >= 4 {
			ks.bad[m] = 0
		}
	case 6:
		if raw <= 2 {
			ks.bad[m]++
		} else if raw >= 3 {
			ks.bad[m] = 0
		}
	}
}

// ResetKarmicCounters clears all per-player karma state for a room.
// Called by the game handler after any settings change.
func (h *Hub) ResetKarmicCounters(code string) {
	h.mu.RLock()
	r, ok := h.rooms[code]
	h.mu.RUnlock()
	if !ok {
		return
	}
	r.karmaMu.Lock()
	r.playerKarma = make(map[uuid.UUID]*karmaState)
	r.karmaMu.Unlock()
}

func (h *Hub) broadcastToRoom(r *Room, evType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	msg, err := json.Marshal(Message{Type: evType, Payload: json.RawMessage(data)})
	if err != nil {
		return
	}
	r.broadcast <- msg
}

func (h *Hub) broadcastToRoomExcept(r *Room, skip *Client, evType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	msg, err := json.Marshal(Message{Type: evType, Payload: json.RawMessage(data)})
	if err != nil {
		return
	}
	r.mu.RLock()
	for c := range r.clients {
		if c == skip {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
	r.mu.RUnlock()
}

func (h *Hub) BroadcastToRoomByCode(code string, evType string, payload any) {
	h.mu.RLock()
	r, ok := h.rooms[code]
	h.mu.RUnlock()
	if ok {
		h.broadcastToRoom(r, evType, payload)
	}
}

func (h *Hub) SendFullState(ctx context.Context, c *Client, roomID uuid.UUID) {
	gs, err := h.store.GetGameState(ctx, roomID)
	if err != nil {
		log.Printf("hub: get game state: %v", err)
		return
	}
	tokens, err := h.store.GetTokensByRoom(ctx, roomID)
	if err != nil {
		log.Printf("hub: get tokens: %v", err)
		return
	}
	characters, err := h.store.GetCharactersByRoom(ctx, roomID)
	if err != nil {
		log.Printf("hub: get characters for full state: %v", err)
		return
	}

	state := map[string]any{
		"game_state": gs,
		"tokens":     tokens,
		"characters": characters,
	}
	data, err := json.Marshal(state)
	if err != nil {
		return
	}
	msg, err := json.Marshal(Message{Type: EvFullState, Payload: json.RawMessage(data)})
	if err != nil {
		return
	}
	c.send <- msg
}

func rollDice(notation string) (int, []int) {
	var n, m, bonus int
	var err error

	plusIdx := -1
	minusIdx := -1
	for i, ch := range notation {
		if ch == '+' && i > 0 {
			plusIdx = i
		} else if ch == '-' && i > 0 {
			minusIdx = i
		}
	}

	dIdx := -1
	for i, ch := range notation {
		if ch == 'd' || ch == 'D' {
			dIdx = i
			break
		}
	}

	if dIdx < 0 {
		fmt := notation
		_ = fmt
		return 0, nil
	}

	nStr := notation[:dIdx]
	if nStr == "" {
		n = 1
	} else {
		n = atoi(nStr)
	}

	var mStr string
	if plusIdx > 0 {
		mStr = notation[dIdx+1 : plusIdx]
		bonus = atoi(notation[plusIdx+1:])
	} else if minusIdx > dIdx {
		mStr = notation[dIdx+1 : minusIdx]
		bonus = -atoi(notation[minusIdx+1:])
	} else {
		mStr = notation[dIdx+1:]
	}
	m = atoi(mStr)
	if n <= 0 || n > 100 || m <= 0 || m > 1000 {
		err = errBadDice
	}
	_ = err

	rolls := make([]int, n)
	total := bonus
	for i := range rolls {
		rolls[i] = rand.IntN(m) + 1
		total += rolls[i]
	}
	return total, rolls
}

var errBadDice = newError("bad dice notation")

type hubError string

func (e hubError) Error() string { return string(e) }
func newError(s string) hubError { return hubError(s) }

func atoi(s string) int {
	n := 0
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			n = n*10 + int(ch-'0')
		}
	}
	return n
}

// parseDiceNotation extracts (n, m, bonus) from strings like "1d20", "2d6+3", "1d8-1".
// Returns ok=false for malformed input or out-of-range values.
func parseDiceNotation(notation string) (int, int, int, bool) {
	dIdx := -1
	for i, ch := range notation {
		if ch == 'd' || ch == 'D' {
			dIdx = i
			break
		}
	}
	if dIdx < 0 {
		return 0, 0, 0, false
	}
	plusIdx, minusIdx := -1, -1
	for i, ch := range notation {
		if ch == '+' && i > dIdx {
			plusIdx = i
		} else if ch == '-' && i > dIdx {
			minusIdx = i
		}
	}
	nStr := notation[:dIdx]
	n := 1
	if nStr != "" {
		n = atoi(nStr)
	}
	var mStr string
	bonus := 0
	if plusIdx > 0 {
		mStr = notation[dIdx+1 : plusIdx]
		bonus = atoi(notation[plusIdx+1:])
	} else if minusIdx > dIdx {
		mStr = notation[dIdx+1 : minusIdx]
		bonus = -atoi(notation[minusIdx+1:])
	} else {
		mStr = notation[dIdx+1:]
	}
	m := atoi(mStr)
	if n <= 0 || n > 100 || m <= 0 || m > 1000 {
		return 0, 0, 0, false
	}
	return n, m, bonus, true
}
