package character

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

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

type characterRequest struct {
	Name       string          `json:"name"`
	Class      string          `json:"class"`
	Race       string          `json:"race"`
	Level      int             `json:"level"`
	HP         int             `json:"hp"`
	MaxHP      int             `json:"max_hp"`
	AC         int             `json:"ac"`
	Stats      json.RawMessage `json:"stats"`
	Weapons    json.RawMessage `json:"weapons"`
	SpellSlots json.RawMessage `json:"spell_slots"`
	Notes      string          `json:"notes"`
}

type patchHPRequest struct {
	Delta int `json:"delta"`
}

type statsRaw struct {
	Strength     int  `json:"strength"`
	Dexterity    int  `json:"dexterity"`
	Constitution int  `json:"constitution"`
	Intelligence int  `json:"intelligence"`
	Wisdom       int  `json:"wisdom"`
	Charisma     int  `json:"charisma"`
	HasShield    bool `json:"has_shield"`
}

type statsEnriched struct {
	statsRaw
	StrMod int `json:"str_mod"`
	DexMod int `json:"dex_mod"`
	ConMod int `json:"con_mod"`
	IntMod int `json:"int_mod"`
	WisMod int `json:"wis_mod"`
	ChaMod int `json:"cha_mod"`
}

type characterResponse struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	RoomID      string          `json:"room_id"`
	Name        string          `json:"name"`
	Class       string          `json:"class"`
	Race        string          `json:"race"`
	Level       int             `json:"level"`
	HP          int             `json:"hp"`
	MaxHP       int             `json:"max_hp"`
	AC          int             `json:"ac"`
	EffectiveAC int             `json:"effective_ac"`
	Stats       *statsEnriched  `json:"stats"`
	Weapons     json.RawMessage `json:"weapons"`
	SpellSlots  json.RawMessage `json:"spell_slots"`
	Notes       string          `json:"notes"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func modifier(score int) int { return (score - 10) / 2 }

func toResponse(c store.Character) characterResponse {
	var raw statsRaw
	if len(c.Stats) > 0 {
		_ = json.Unmarshal(c.Stats, &raw)
	}
	enriched := &statsEnriched{
		statsRaw: raw,
		StrMod:   modifier(raw.Strength),
		DexMod:   modifier(raw.Dexterity),
		ConMod:   modifier(raw.Constitution),
		IntMod:   modifier(raw.Intelligence),
		WisMod:   modifier(raw.Wisdom),
		ChaMod:   modifier(raw.Charisma),
	}
	effectiveAC := c.AC
	if raw.HasShield {
		effectiveAC += 2
	}
	return characterResponse{
		ID:          c.ID.String(),
		UserID:      c.UserID.String(),
		RoomID:      c.RoomID.String(),
		Name:        c.Name,
		Class:       c.Class,
		Race:        c.Race,
		Level:       c.Level,
		HP:          c.HP,
		MaxHP:       c.MaxHP,
		AC:          c.AC,
		EffectiveAC: effectiveAC,
		Stats:       enriched,
		Weapons:     c.Weapons,
		SpellSlots:  c.SpellSlots,
		Notes:       c.Notes,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
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

// /api/v1/rooms/{code}/characters
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req characterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_VALIDATION")
		return
	}

	c, err := h.store.CreateCharacter(r.Context(), userID, room.ID, store.CharacterInput{
		Name: req.Name, Class: req.Class, Race: req.Race,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots, Notes: req.Notes,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toResponse(c))
}

// /api/v1/rooms/{code}/characters
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

	chars, err := h.store.GetCharactersByRoom(r.Context(), room.ID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	result := make([]characterResponse, 0, len(chars))
	for _, c := range chars {
		result = append(result, toResponse(c))
	}
	httputil.JSON(w, http.StatusOK, result)
}

// /api/v1/characters/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid character id", "ERR_BAD_REQUEST")
		return
	}

	c, err := h.store.GetCharacterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "character not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if c.UserID != userID {
		if _, err := h.store.GetMemberRoleByRoomID(r.Context(), c.RoomID, userID); err != nil {
			httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
			return
		}
	}

	httputil.JSON(w, http.StatusOK, toResponse(c))
}

// /api/v1/characters/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid character id", "ERR_BAD_REQUEST")
		return
	}

	existing, err := h.store.GetCharacterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "character not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if existing.UserID != userID {
		httputil.Error(w, http.StatusForbidden, "only the owner can update this character", "ERR_FORBIDDEN")
		return
	}

	var req characterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_VALIDATION")
		return
	}

	updated, err := h.store.UpdateCharacter(r.Context(), id, store.CharacterInput{
		Name: req.Name, Class: req.Class, Race: req.Race,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots, Notes: req.Notes,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toResponse(updated))
}

// /api/v1/characters/{id}/hp
func (h *Handler) PatchHP(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid character id", "ERR_BAD_REQUEST")
		return
	}

	c, err := h.store.GetCharacterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "character not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if c.UserID != userID {
		role, err := h.store.GetMemberRoleByRoomID(r.Context(), c.RoomID, userID)
		if err != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "only the owner or DM can update HP", "ERR_FORBIDDEN")
			return
		}
	}

	var req patchHPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}

	updated, err := h.store.UpdateCharacterHP(r.Context(), id, req.Delta)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toResponse(updated))
}

// /api/v1/characters/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid character id", "ERR_BAD_REQUEST")
		return
	}

	c, err := h.store.GetCharacterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "character not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if c.UserID != userID {
		httputil.Error(w, http.StatusForbidden, "only the owner can delete this character", "ERR_FORBIDDEN")
		return
	}

	if err := h.store.DeleteCharacter(r.Context(), id); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
