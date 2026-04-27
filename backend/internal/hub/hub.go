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
	EvTokenUpdate    = "TOKEN_UPDATE"
	EvTokenDelete    = "TOKEN_DELETE"
	EvDiceRoll       = "DICE_ROLL"
	EvDiceRollResult = "DICE_ROLL_RESULT"
	EvGridUpdate     = "GRID_UPDATE"
	EvFogReveal      = "FOG_REVEAL"
	EvFogClear       = "FOG_CLEAR"
	EvInitUpdate     = "INIT_UPDATE"
	EvInitNext       = "INIT_NEXT"
	EvInitEnd        = "INIT_END"
	EvRulerUpdate    = "RULER_UPDATE"
	EvFullState      = "FULL_STATE_UPDATE"
	EvMapUpdate      = "MAP_UPDATE"
)

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Client struct {
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	role   string
	room   *Room
}

type Room struct {
	code       string
	clients    map[*Client]struct{}
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
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

func (h *Hub) getOrCreateRoom(code string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.rooms[code]
	if !ok {
		r = &Room{
			code:       code,
			clients:    make(map[*Client]struct{}),
			broadcast:  make(chan []byte, 256),
			register:   make(chan *Client),
			unregister: make(chan *Client),
		}
		h.rooms[code] = r
		go r.run()
	}
	return r
}

func (r *Room) run() {
	for {
		select {
		case c := <-r.register:
			r.mu.Lock()
			r.clients[c] = struct{}{}
			r.mu.Unlock()

		case c := <-r.unregister:
			r.mu.Lock()
			if _, ok := r.clients[c]; ok {
				delete(r.clients, c)
				close(c.send)
			}
			r.mu.Unlock()

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
		h.handleDiceRoll(c, msg.Payload)

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
		h.broadcastToRoom(c.room, EvTokenDelete, map[string]string{"id": p.ID.String()})

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

	case EvFogReveal, EvFogClear:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.FogCells = msg.Payload
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: fog update: %v", err)
			return
		}
		h.broadcastToRoom(c.room, msg.Type, msg.Payload)

	case EvInitUpdate:
		if c.role != "dm" {
			return
		}
		gs, err := h.store.GetGameState(ctx, roomID)
		if err != nil {
			return
		}
		gs.InitiativeOrder = msg.Payload
		if err := h.store.UpsertGameState(ctx, gs); err != nil {
			log.Printf("hub: initiative update: %v", err)
			return
		}
		h.broadcastToRoom(c.room, EvInitUpdate, msg.Payload)

	case EvInitNext, EvInitEnd:
		if c.role != "dm" {
			return
		}
		h.broadcastToRoom(c.room, msg.Type, msg.Payload)

	case EvRulerUpdate:
		h.broadcastToRoom(c.room, EvRulerUpdate, msg.Payload)

	case EvMapUpdate:
		if c.role != "dm" {
			return
		}
		h.broadcastToRoom(c.room, EvMapUpdate, msg.Payload)
	}
}

type diceRollPayload struct {
	Notation string `json:"notation"`
}

func (h *Hub) handleDiceRoll(c *Client, payload json.RawMessage) {
	var p diceRollPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return
	}
	total, rolls := rollDice(p.Notation)
	result := map[string]any{
		"user_id":  c.userID.String(),
		"notation": p.Notation,
		"rolls":    rolls,
		"total":    total,
	}
	h.broadcastToRoom(c.room, EvDiceRollResult, result)
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

	state := map[string]any{
		"game_state": gs,
		"tokens":     tokens,
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
