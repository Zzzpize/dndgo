package hub

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// GET /api/v1/ws/{code}?token=<jwt>
func (h *Hub) ServeWS(secret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := chi.URLParam(r, "code")

		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			httputil.Error(w, http.StatusUnauthorized, "missing token", "ERR_UNAUTHORIZED")
			return
		}
		claims, err := auth.ValidateToken(tokenStr, secret)
		if err != nil {
			httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
			return
		}
		userID, err := uuid.Parse(claims.Subject)
		if err != nil {
			httputil.Error(w, http.StatusUnauthorized, "invalid token subject", "ERR_UNAUTHORIZED")
			return
		}

		room, role, err := h.store.GetRoomMembership(r.Context(), code, userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				httputil.Error(w, http.StatusForbidden, "room not found or access denied", "ERR_FORBIDDEN")
				return
			}
			httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade: %v", err)
			return
		}

		client := &Client{
			conn:   conn,
			send:   make(chan []byte, 256),
			userID: userID,
			role:   role,
		}

		h.AddClient(client, code)

		h.SendFullState(context.Background(), client, room.ID)

		go client.writePump()
		go h.readPump(client, room.ID)
	}
}
