package game

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
)

// GET /api/v1/rooms/{code}/events?limit=50&before={timestamp}
func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusUnauthorized, "invalid token subject", "ERR_UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	room, _, err := h.store.GetRoomMembership(r.Context(), code, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusForbidden, "room not found or access denied", "ERR_FORBIDDEN")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}

	before := time.Now().UTC()
	if v := r.URL.Query().Get("before"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			before = t
		}
	}

	evts, err := h.store.GetGameEvents(r.Context(), room.ID, limit, before)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusOK, evts)
}
