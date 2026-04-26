package bestiary

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/httputil"
	"github.com/zzzpize/dndgo/backend/internal/store"
)

type Handler struct {
	store *store.Store
}

func NewHandler(st *store.Store) *Handler {
	return &Handler{store: st}
}

type bestiaryResponse struct {
	Monsters []store.MonsterSummary `json:"monsters"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	Limit    int                    `json:"limit"`
}

// /api/v1/bestiary?q=&page=&limit=
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")

	page := queryInt(r, "page", 1)
	limit := queryInt(r, "limit", 20)
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	total, err := h.store.CountMonsters(r.Context(), q)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	monsters, err := h.store.ListMonsters(r.Context(), q, limit, offset)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	if monsters == nil {
		monsters = []store.MonsterSummary{}
	}

	httputil.JSON(w, http.StatusOK, bestiaryResponse{
		Monsters: monsters,
		Total:    total,
		Page:     page,
		Limit:    limit,
	})
}

// /api/v1/bestiary/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id < 1 {
		httputil.Error(w, http.StatusBadRequest, "invalid monster id", "ERR_BAD_REQUEST")
		return
	}

	monster, err := h.store.GetMonsterByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "monster not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusOK, monster)
}

func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
