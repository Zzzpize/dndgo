package game

import (
	"encoding/json"
	"errors"
	"math/rand/v2"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
	"github.com/zzzpize/dndgo/backend/internal/store"
)

const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

type Handler struct {
	store *store.Store
}

func NewHandler(st *store.Store) *Handler {
	return &Handler{store: st}
}

type createRoomRequest struct {
	Name string `json:"name"`
}

type joinRoomRequest struct {
	Code string `json:"code"`
}

type memberResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type roomResponse struct {
	ID        string           `json:"id"`
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	DmUserID  string           `json:"dm_user_id"`
	CreatedAt time.Time        `json:"created_at"`
	Role      string           `json:"role,omitempty"`
	Members   []memberResponse `json:"members,omitempty"`
}

func toRoomResponse(r store.Room, role string, members []store.RoomMember) roomResponse {
	resp := roomResponse{
		ID:        r.ID.String(),
		Code:      r.Code,
		Name:      r.Name,
		DmUserID:  r.DmUserID.String(),
		CreatedAt: r.CreatedAt,
		Role:      role,
	}
	for _, m := range members {
		resp.Members = append(resp.Members, memberResponse{
			UserID:   m.UserID.String(),
			Username: m.Username,
			Role:     m.Role,
		})
	}
	return resp
}

func generateCode() string {
	b := make([]byte, 6)
	for i := range b {
		b[i] = codeChars[rand.IntN(len(codeChars))]
	}
	return string(b)
}

func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.ClaimsFromContext(r.Context())
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	var req createRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_VALIDATION")
		return
	}

	var room store.Room
	for attempt := 0; attempt < 5; attempt++ {
		room, err = h.store.CreateRoom(r.Context(), generateCode(), req.Name, userID)
		if err == nil {
			break
		}
		if !store.IsUniqueViolation(err) {
			httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
			return
		}
	}
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "could not generate unique room code", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusCreated, toRoomResponse(room, "dm", nil))
}

func (h *Handler) ListRooms(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.ClaimsFromContext(r.Context())
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	rooms, err := h.store.ListUserRooms(r.Context(), userID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	result := make([]roomResponse, 0, len(rooms))
	for _, room := range rooms {
		result = append(result, toRoomResponse(room, room.Role, nil))
	}
	httputil.JSON(w, http.StatusOK, result)
}

func (h *Handler) GetRoom(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.ClaimsFromContext(r.Context())
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
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

	members, err := h.store.GetRoomMembers(r.Context(), room.ID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusOK, toRoomResponse(room, role, members))
}

func (h *Handler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.ClaimsFromContext(r.Context())
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	var req joinRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
		httputil.Error(w, http.StatusBadRequest, "code is required", "ERR_VALIDATION")
		return
	}

	room, err := h.store.GetRoomByCode(r.Context(), req.Code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "room not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if err := h.store.AddRoomMember(r.Context(), room.ID, userID); err != nil {
		if store.IsUniqueViolation(err) {
			httputil.Error(w, http.StatusConflict, "already a member of this room", "ERR_CONFLICT")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusOK, toRoomResponse(room, "player", nil))
}

func (h *Handler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.ClaimsFromContext(r.Context())
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	code := chi.URLParam(r, "code")
	room, err := h.store.GetRoomByCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "room not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if room.DmUserID != userID {
		httputil.Error(w, http.StatusForbidden, "only the DM can delete a room", "ERR_FORBIDDEN")
		return
	}

	if err := h.store.DeleteRoom(r.Context(), room.ID); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
