package game

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/zzzpize/dndgo/backend/internal/auth"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
)

const maxMapBytes = 20 << 20

var allowedMapExts = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true,
}

func (h *Handler) UploadMap(w http.ResponseWriter, r *http.Request) {
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
	if role != "dm" {
		httputil.Error(w, http.StatusForbidden, "only the DM can upload maps", "ERR_FORBIDDEN")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxMapBytes)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		httputil.Error(w, http.StatusRequestEntityTooLarge, "file too large (max 20 MB)", "ERR_TOO_LARGE")
		return
	}

	file, header, err := r.FormFile("map")
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, "field 'map' is required", "ERR_VALIDATION")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedMapExts[ext] {
		httputil.Error(w, http.StatusBadRequest, "only jpg, png, webp files are allowed", "ERR_VALIDATION")
		return
	}

	dir := filepath.Join(h.staticDir, "maps", code)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	filename := uuid.New().String() + ext
	dst := filepath.Join(dir, filename)
	out, err := os.Create(dst)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	mapURL := fmt.Sprintf("%s/static/maps/%s/%s", h.publicURL, code, filename)

	if err := h.store.UpdateMapImageURL(r.Context(), room.ID, mapURL); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if h.broadcaster != nil {
		h.broadcaster.BroadcastToRoomByCode(code, "MAP_UPDATE", map[string]string{"map_image_url": mapURL})
	}

	httputil.JSON(w, http.StatusOK, map[string]string{"map_image_url": mapURL})
}
