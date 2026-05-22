package npc

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
	"github.com/zzzpize/dndgo/backend/internal/store"
)

var (
	abilityKeyMap = map[string]string{
		"Сила": "str", "Ловкость": "dex", "Телосложение": "con",
		"Интеллект": "int", "Мудрость": "wis", "Харизма": "cha",
	}
	leadingNumRe = regexp.MustCompile(`^\s*(\d+)`)
)

func convertAbilities(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	var src map[string]string
	if err := json.Unmarshal(raw, &src); err != nil {
		return json.RawMessage(`{}`)
	}
	result := make(map[string]int, 6)
	for ruKey, engKey := range abilityKeyMap {
		if val, ok := src[ruKey]; ok {
			if m := leadingNumRe.FindStringSubmatch(val); len(m) > 1 {
				n, _ := strconv.Atoi(m[1])
				result[engKey] = n
			}
		}
	}
	out, _ := json.Marshal(result)
	return out
}

func parseLeadingInt(s string, fallback int) int {
	if m := leadingNumRe.FindStringSubmatch(s); len(m) > 1 {
		if n, err := strconv.Atoi(m[1]); err == nil {
			return n
		}
	}
	return fallback
}

type Handler struct {
	store *store.Store
}

func NewHandler(st *store.Store) *Handler {
	return &Handler{store: st}
}

type npcRequest struct {
	FolderID      *string         `json:"folder_id"`
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
	FolderID      *string         `json:"folder_id"`
	Name          string          `json:"name"`
	Disposition   string          `json:"disposition"`
	AC            string          `json:"ac"`
	MaxHP         int             `json:"max_hp"`
	Speed         string          `json:"speed"`
	TypeAlignment string          `json:"type_alignment"`
	Abilities     json.RawMessage `json:"abilities"`
	Actions       json.RawMessage `json:"actions"`
	CreatedAt     time.Time       `json:"created_at"`
}

type folderResponse struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

func toResponse(n store.NPC) npcResponse {
	var folderID *string
	if n.FolderID != nil {
		s := n.FolderID.String()
		folderID = &s
	}
	return npcResponse{
		ID: n.ID.String(), UserID: n.UserID.String(), RoomID: n.RoomID.String(),
		FolderID: folderID,
		Name: n.Name, Disposition: n.Disposition,
		AC: n.AC, MaxHP: n.MaxHP, Speed: n.Speed,
		TypeAlignment: n.TypeAlignment,
		Abilities: n.Abilities, Actions: n.Actions,
		CreatedAt: n.CreatedAt,
	}
}

func toFolderResponse(f store.NpcFolder) folderResponse {
	return folderResponse{ID: f.ID.String(), RoomID: f.RoomID.String(), Name: f.Name, CreatedAt: f.CreatedAt}
}

func parseUserID(r *http.Request) (uuid.UUID, bool) {
	claims, ok := auth.ClaimsFromContext(r.Context())
	if !ok {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(claims.Subject)
	return id, err == nil
}

func parseFolderID(s *string) (*uuid.UUID, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	id, err := uuid.Parse(*s)
	if err != nil {
		return nil, err
	}
	return &id, nil
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

	folderID, err := parseFolderID(req.FolderID)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder_id", "ERR_BAD_REQUEST")
		return
	}

	n, err := h.store.CreateNPC(r.Context(), userID, room.ID, store.NPCInput{
		FolderID: folderID, Name: req.Name, Disposition: req.Disposition, AC: req.AC,
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

	folderID, err := parseFolderID(req.FolderID)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder_id", "ERR_BAD_REQUEST")
		return
	}

	updated, err := h.store.UpdateNPC(r.Context(), id, store.NPCInput{
		FolderID: folderID, Name: req.Name, Disposition: req.Disposition, AC: req.AC,
		MaxHP: req.MaxHP, Speed: req.Speed, TypeAlignment: req.TypeAlignment,
		Abilities: req.Abilities, Actions: req.Actions,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toResponse(updated))
}

// PATCH /api/v1/npcs/{id}/folder
func (h *Handler) SetFolder(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		FolderID *string `json:"folder_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}

	folderID, err := parseFolderID(body.FolderID)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder_id", "ERR_BAD_REQUEST")
		return
	}

	if err := h.store.SetNPCFolder(r.Context(), id, folderID); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

// POST /api/v1/rooms/{code}/npcs/from-bestiary
func (h *Handler) CreateFromBestiary(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	room, role, err := h.store.GetRoomMembership(r.Context(), code, userID)
	if err != nil || role != "dm" {
		httputil.Error(w, http.StatusForbidden, "only DM can manage NPCs", "ERR_FORBIDDEN")
		return
	}

	var body struct {
		MonsterID int     `json:"monster_id"`
		FolderID  *string `json:"folder_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.MonsterID == 0 {
		httputil.Error(w, http.StatusBadRequest, "monster_id is required", "ERR_BAD_REQUEST")
		return
	}

	monster, err := h.store.GetMonsterByID(r.Context(), body.MonsterID)
	if err != nil {
		httputil.Error(w, http.StatusNotFound, "monster not found", "ERR_NOT_FOUND")
		return
	}

	folderID, err := parseFolderID(body.FolderID)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder_id", "ERR_BAD_REQUEST")
		return
	}

	n, err := h.store.CreateNPC(r.Context(), userID, room.ID, store.NPCInput{
		FolderID:      folderID,
		Name:          monster.NameRu,
		Disposition:   "hostile",
		AC:            monster.ArmorClass,
		MaxHP:         parseLeadingInt(monster.HitPoints, 1),
		Speed:         monster.Speed,
		TypeAlignment: monster.TypeAndAlignment,
		Abilities:     convertAbilities(monster.Abilities),
		Actions:       monster.Actions,
	})
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toResponse(n))
}

// POST /api/v1/rooms/{code}/npc-folders
func (h *Handler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	room, role, err := h.store.GetRoomMembership(r.Context(), code, userID)
	if err != nil || role != "dm" {
		httputil.Error(w, http.StatusForbidden, "only DM can manage folders", "ERR_FORBIDDEN")
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_BAD_REQUEST")
		return
	}

	f, err := h.store.CreateNpcFolder(r.Context(), room.ID, body.Name)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, toFolderResponse(f))
}

// GET /api/v1/rooms/{code}/npc-folders
func (h *Handler) ListFolders(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	code := chi.URLParam(r, "code")
	room, _, err := h.store.GetRoomMembership(r.Context(), code, userID)
	if err != nil {
		httputil.Error(w, http.StatusForbidden, "room not found or access denied", "ERR_FORBIDDEN")
		return
	}

	folders, err := h.store.GetNpcFoldersByRoom(r.Context(), room.ID)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	result := make([]folderResponse, 0, len(folders))
	for _, f := range folders {
		result = append(result, toFolderResponse(f))
	}
	httputil.JSON(w, http.StatusOK, result)
}

// PUT /api/v1/npc-folders/{id}
func (h *Handler) RenameFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder id", "ERR_BAD_REQUEST")
		return
	}

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		httputil.Error(w, http.StatusBadRequest, "name is required", "ERR_BAD_REQUEST")
		return
	}

	_ = userID
	f, err := h.store.RenameNpcFolder(r.Context(), id, body.Name)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, toFolderResponse(f))
}

// DELETE /api/v1/npc-folders/{id}
func (h *Handler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseUserID(r)
	if !ok {
		httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
		return
	}
	_ = userID

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid folder id", "ERR_BAD_REQUEST")
		return
	}

	if err := h.store.DeleteNpcFolder(r.Context(), id); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
