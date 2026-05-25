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
	Subclass   string          `json:"subclass"`
	Race       string          `json:"race"`
	Subrace    string          `json:"subrace"`
	Level      int             `json:"level"`
	HP         int             `json:"hp"`
	MaxHP      int             `json:"max_hp"`
	AC         int             `json:"ac"`
	TempHP     int             `json:"temp_hp"`
	Stats      json.RawMessage `json:"stats"`
	Weapons    json.RawMessage `json:"weapons"`
	SpellSlots json.RawMessage `json:"spell_slots"`
	Abilities  json.RawMessage `json:"abilities"`
	Inventory  string          `json:"inventory"`
	Notes      string          `json:"notes"`
}

type patchHPRequest struct {
	Delta  int  `json:"delta"`
	TempHP *int `json:"temp_hp,omitempty"`
}

type statsRaw struct {
	Strength     int    `json:"strength"`
	Dexterity    int    `json:"dexterity"`
	Constitution int    `json:"constitution"`
	Intelligence int    `json:"intelligence"`
	Wisdom       int    `json:"wisdom"`
	Charisma     int    `json:"charisma"`
	ShieldBonus  int    `json:"shield_bonus"`
	Speed        string `json:"speed"`
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
	ID           string          `json:"id"`
	UserID       string          `json:"user_id"`
	RoomID       string          `json:"room_id"`
	Name         string          `json:"name"`
	Class        string          `json:"class"`
	Subclass     string          `json:"subclass"`
	Race         string          `json:"race"`
	Subrace      string          `json:"subrace"`
	Level        int             `json:"level"`
	HP           int             `json:"hp"`
	MaxHP        int             `json:"max_hp"`
	AC           int             `json:"ac"`
	TempHP       int             `json:"temp_hp"`
	EffectiveAC  int             `json:"effective_ac"`
	PlayerActive bool            `json:"player_active"`
	Stats        *statsEnriched  `json:"stats"`
	Weapons      json.RawMessage `json:"weapons"`
	SpellSlots   json.RawMessage `json:"spell_slots"`
	Abilities    json.RawMessage `json:"abilities"`
	Inventory    string          `json:"inventory"`
	Notes        string          `json:"notes"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
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
	effectiveAC := c.AC + raw.ShieldBonus
	return characterResponse{
		ID:           c.ID.String(),
		UserID:       c.UserID.String(),
		RoomID:       c.RoomID.String(),
		Name:         c.Name,
		Class:        c.Class,
		Subclass:     c.Subclass,
		Race:         c.Race,
		Subrace:      c.Subrace,
		Level:        c.Level,
		HP:           c.HP,
		MaxHP:        c.MaxHP,
		AC:           c.AC,
		TempHP:       c.TempHP,
		EffectiveAC:  effectiveAC,
		PlayerActive: c.PlayerActive,
		Stats:        enriched,
		Weapons:      c.Weapons,
		SpellSlots:   c.SpellSlots,
		Abilities:    c.Abilities,
		Inventory:    c.Inventory,
		Notes:        c.Notes,
		CreatedAt:    c.CreatedAt,
		UpdatedAt:    c.UpdatedAt,
	}
}

type templateResponse struct {
	ID         string          `json:"id"`
	UserID     string          `json:"user_id"`
	Name       string          `json:"name"`
	Class      string          `json:"class"`
	Subclass   string          `json:"subclass"`
	Race       string          `json:"race"`
	Subrace    string          `json:"subrace"`
	Level      int             `json:"level"`
	HP         int             `json:"hp"`
	MaxHP      int             `json:"max_hp"`
	AC         int             `json:"ac"`
	TempHP     int             `json:"temp_hp"`
	EffectiveAC int            `json:"effective_ac"`
	Stats      *statsEnriched  `json:"stats"`
	Weapons    json.RawMessage `json:"weapons"`
	SpellSlots json.RawMessage `json:"spell_slots"`
	Abilities  json.RawMessage `json:"abilities"`
	Inventory  string          `json:"inventory"`
	Notes      string          `json:"notes"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

func toTemplateResponse(t store.CharacterTemplate) templateResponse {
	var raw statsRaw
	if len(t.Stats) > 0 {
		_ = json.Unmarshal(t.Stats, &raw)
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
	return templateResponse{
		ID:          t.ID.String(),
		UserID:      t.UserID.String(),
		Name:        t.Name,
		Class:       t.Class,
		Subclass:    t.Subclass,
		Race:        t.Race,
		Subrace:     t.Subrace,
		Level:       t.Level,
		HP:          t.HP,
		MaxHP:       t.MaxHP,
		AC:          t.AC,
		TempHP:      t.TempHP,
		EffectiveAC: t.AC + raw.ShieldBonus,
		Stats:       enriched,
		Weapons:     t.Weapons,
		SpellSlots:  t.SpellSlots,
		Abilities:   t.Abilities,
		Inventory:   t.Inventory,
		Notes:       t.Notes,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
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
		Name: req.Name, Class: req.Class, Subclass: req.Subclass,
		Race: req.Race, Subrace: req.Subrace,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC, TempHP: req.TempHP,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots,
		Abilities: req.Abilities, Inventory: req.Inventory, Notes: req.Notes,
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
		role, roleErr := h.store.GetMemberRoleByRoomID(r.Context(), existing.RoomID, userID)
		if roleErr != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "only the owner or DM can update this character", "ERR_FORBIDDEN")
			return
		}
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
		Name: req.Name, Class: req.Class, Subclass: req.Subclass,
		Race: req.Race, Subrace: req.Subrace,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC, TempHP: req.TempHP,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots,
		Abilities: req.Abilities, Inventory: req.Inventory, Notes: req.Notes,
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

	updated, err := h.store.UpdateCharacterHP(r.Context(), id, req.Delta, req.TempHP)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toResponse(updated))
}

// /api/v1/characters/templates
func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	templates, err := h.store.GetTemplatesByUser(r.Context(), userID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	result := make([]templateResponse, 0, len(templates))
	for _, t := range templates {
		result = append(result, toTemplateResponse(t))
	}
	httputil.JSON(w, http.StatusOK, result)
}

// /api/v1/characters/templates
func (h *Handler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
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

	t, err := h.store.CreateTemplate(r.Context(), userID, store.CharacterInput{
		Name: req.Name, Class: req.Class, Subclass: req.Subclass,
		Race: req.Race, Subrace: req.Subrace,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC, TempHP: req.TempHP,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots,
		Abilities: req.Abilities, Inventory: req.Inventory, Notes: req.Notes,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toTemplateResponse(t))
}

// /api/v1/characters/templates/{id}
func (h *Handler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid template id", "ERR_BAD_REQUEST")
		return
	}

	existing, err := h.store.GetTemplateByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "template not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if existing.UserID != userID {
		httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
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

	updated, err := h.store.UpdateTemplate(r.Context(), id, store.CharacterInput{
		Name: req.Name, Class: req.Class, Subclass: req.Subclass,
		Race: req.Race, Subrace: req.Subrace,
		Level: req.Level, HP: req.HP, MaxHP: req.MaxHP, AC: req.AC, TempHP: req.TempHP,
		Stats: req.Stats, Weapons: req.Weapons, SpellSlots: req.SpellSlots,
		Abilities: req.Abilities, Inventory: req.Inventory, Notes: req.Notes,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toTemplateResponse(updated))
}

// /api/v1/characters/templates/{id}
func (h *Handler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid template id", "ERR_BAD_REQUEST")
		return
	}

	existing, err := h.store.GetTemplateByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "template not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if existing.UserID != userID {
		httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
		return
	}

	if err := h.store.DeleteTemplate(r.Context(), id); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// /api/v1/rooms/{code}/characters/from-template/{templateId}
func (h *Handler) ImportTemplate(w http.ResponseWriter, r *http.Request) {
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

	templateID, err := uuid.Parse(chi.URLParam(r, "templateId"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid template id", "ERR_BAD_REQUEST")
		return
	}

	tmpl, err := h.store.GetTemplateByID(r.Context(), templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "template not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if tmpl.UserID != userID {
		httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
		return
	}

	c, err := h.store.CreateCharacter(r.Context(), userID, room.ID, store.CharacterInput{
		Name: tmpl.Name, Class: tmpl.Class, Subclass: tmpl.Subclass,
		Race: tmpl.Race, Subrace: tmpl.Subrace,
		Level: tmpl.Level, HP: tmpl.MaxHP, MaxHP: tmpl.MaxHP, AC: tmpl.AC, TempHP: 0,
		Stats: tmpl.Stats, Weapons: tmpl.Weapons, SpellSlots: tmpl.SpellSlots,
		Abilities: tmpl.Abilities, Inventory: tmpl.Inventory, Notes: tmpl.Notes,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toResponse(c))
}

// /api/v1/characters/{id}/export-template
func (h *Handler) ExportToTemplate(w http.ResponseWriter, r *http.Request) {
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
		role, roleErr := h.store.GetMemberRoleByRoomID(r.Context(), c.RoomID, userID)
		if roleErr != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
			return
		}
	}

	var req struct {
		Overwrite bool `json:"overwrite"`
		Duplicate bool `json:"duplicate"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	input := store.CharacterInput{
		Name: c.Name, Class: c.Class, Subclass: c.Subclass,
		Race: c.Race, Subrace: c.Subrace,
		Level: c.Level, HP: c.MaxHP, MaxHP: c.MaxHP, AC: c.AC, TempHP: 0,
		Stats: c.Stats, Weapons: c.Weapons, SpellSlots: c.SpellSlots,
		Abilities: c.Abilities, Inventory: c.Inventory, Notes: c.Notes,
	}

	existing, lookupErr := h.store.GetTemplateByUserAndName(r.Context(), userID, c.Name)
	if lookupErr != nil && !errors.Is(lookupErr, pgx.ErrNoRows) {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	hasConflict := lookupErr == nil
	if hasConflict && !req.Overwrite && !req.Duplicate {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{
			"template_id": existing.ID.String(),
			"name":        existing.Name,
		})
		return
	}

	var t store.CharacterTemplate
	if hasConflict && req.Overwrite {
		t, err = h.store.UpdateTemplate(r.Context(), existing.ID, input)
	} else {
		t, err = h.store.CreateTemplate(r.Context(), userID, input)
	}
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toTemplateResponse(t))
}

// /api/v1/characters/{id}/active
func (h *Handler) SetActive(w http.ResponseWriter, r *http.Request) {
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
		role, roleErr := h.store.GetMemberRoleByRoomID(r.Context(), c.RoomID, userID)
		if roleErr != nil || role != "dm" {
			httputil.Error(w, http.StatusForbidden, "access denied", "ERR_FORBIDDEN")
			return
		}
	}

	var req struct {
		Active bool `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}

	updated, err := h.store.SetCharacterActive(r.Context(), id, req.Active)
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
