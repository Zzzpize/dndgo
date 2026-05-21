package npc

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
	"github.com/zzzpize/dndgo/backend/internal/store"
)

type Handler struct {
	store *store.Store
}

func NewHandler(st *store.Store) *Handler {
	return &Handler{store: st}
}

type npcRequest struct {
	Name          string          `json:"name"`
	Disposition   string          `json:"disposition"`
	AC            string          `json:"ac"`
	MaxHP         int             `json:"max_hp"`
	Speed         string          `json:"speed"`
	TypeAlignment string          `json:"type_alignment"`
	Abilities     json.RawMessage `json:"abilities"`
	Actions       json.RawMessage `json:"actions"`
}

type npcResponse struct {
	ID            string          `json:"id"`
	UserID        string          `json:"user_id"`
	RoomID        string          `json:"room_id"`
	Name          string          `json:"name"`
	Disposition   string          `json:"disposition"`
	AC            string          `json:"ac"`
	MaxHP         int             `json:"max_hp"`
	Speed         string          `json:"speed"`
	TypeAlignment string          `json:"type_alignment"`
	Abilities     json.RawMessage `json:"abilities"`
	Actions       json.RawMessage `json:"actions"`
}

func toResponse(n store.NPC) npcResponse {
	return npcResponse{
		ID: n.ID.String(), UserID: n.UserID.String(), RoomID: n.RoomID.String(),
		Name: n.Name, Disposition: n.Disposition,
		AC: n.AC, MaxHP: n.MaxHP, Speed: n.Speed,
		TypeAlignment: n.TypeAlignment,
		Abilities: n.Abilities, Actions: n.Actions,
	}
}

func parseUserID(r *http.Request) (uuid.UUID, bool) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(claims.Subject)
	return id, err == nil
}

// POST /api/v1/rooms/{code}/npcs
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	room, role, err := h.store.GetRoomMembership(r.Context(), code, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusForbidden, "room not found or access denied", "ERR_FORBIDDEN")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if role != "dm" {
		httputil.Error(w, http.StatusForbidden, "only DM can manage NPCs", "ERR_FORBIDDEN")
		return
	}

	var req npcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_VALIDATION")
		return
	}
	if req.Disposition == "" {
		req.Disposition = "hostile"
	}

	n, err := h.store.CreateNPC(r.Context(), userID, room.ID, store.NPCInput{
		Name: req.Name, Disposition: req.Disposition, AC: req.AC,
		MaxHP: req.MaxHP, Speed: req.Speed, TypeAlignment: req.TypeAlignment,
		Abilities: req.Abilities, Actions: req.Actions,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toResponse(n))
}

// GET /api/v1/rooms/{code}/npcs
func (h *Handler) ListByRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
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

	npcs, err := h.store.GetNPCsByRoom(r.Context(), room.ID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	result := make([]npcResponse, 0, len(npcs))
	for _, n := range npcs {
		result = append(result, toResponse(n))
	}
	httputil.JSON(w, http.StatusOK, result)
}

// PUT /api/v1/npcs/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid npc id", "ERR_BAD_REQUEST")
		return
	}

	existing, err := h.store.GetNPCByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "npc not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if existing.UserID != userID {
		role, roleErr := h.store.GetMemberRoleByRoomID(r.Context(), existing.RoomID, userID)
		if roleErr != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "only the owner or DM can update this NPC", "ERR_FORBIDDEN")
			return
		}
	}

	var req npcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_VALIDATION")
		return
	}

	updated, err := h.store.UpdateNPC(r.Context(), id, store.NPCInput{
		Name: req.Name, Disposition: req.Disposition, AC: req.AC,
		MaxHP: req.MaxHP, Speed: req.Speed, TypeAlignment: req.TypeAlignment,
		Abilities: req.Abilities, Actions: req.Actions,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toResponse(updated))
}

// DELETE /api/v1/npcs/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid npc id", "ERR_BAD_REQUEST")
		return
	}

	existing, err := h.store.GetNPCByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "npc not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if existing.UserID != userID {
		role, roleErr := h.store.GetMemberRoleByRoomID(r.Context(), existing.RoomID, userID)
		if roleErr != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "only the owner or DM can delete this NPC", "ERR_FORBIDDEN")
			return
		}
	}

	if err := h.store.DeleteNPC(r.Context(), id); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
