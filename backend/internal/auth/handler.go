package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/zzzpize/dndgo/backend/internal/email"
	"github.com/zzzpize/dndgo/backend/internal/httputil"
	"github.com/zzzpize/dndgo/backend/internal/store"
)

type Handler struct {
	store  *store.Store
	secret string
	email  *email.Sender
}

func NewHandler(st *store.Store, secret string, emailSender *email.Sender) *Handler {
	return &Handler{store: st, secret: secret, email: emailSender}
}

type registerRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userResponse struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Username string `json:"username"`
}

type authResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

func generateVerifyCode() string {
	return fmt.Sprintf("%06d", rand.IntN(1000000))
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Email == "" || req.Username == "" || req.Password == "" {
		httputil.Error(w, http.StatusBadRequest, "email, username and password are required", "ERR_VALIDATION")
		return
	}
	if len(req.Password) < 8 {
		httputil.Error(w, http.StatusBadRequest, "password must be at least 8 characters", "ERR_VALIDATION")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	// If unverified account with this email exists, just resend the code
	if existing, err := h.store.GetUserByEmail(r.Context(), req.Email); err == nil && !existing.EmailVerified {
		if h.email.Enabled() {
			code := generateVerifyCode()
			expires := time.Now().Add(24 * time.Hour)
			if err := h.store.SetVerifyCode(r.Context(), req.Email, code, expires); err != nil {
				httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
				return
			}
			go h.email.SendVerification(req.Email, existing.Username, code)
			httputil.JSON(w, http.StatusCreated, map[string]any{"verification_required": true})
			return
		}
	}

	emailVerified := !h.email.Enabled()
	user, err := h.store.CreateUser(r.Context(), req.Email, req.Username, string(hash), emailVerified)
	if err != nil {
		if store.IsUniqueViolation(err) {
			httputil.Error(w, http.StatusConflict, "email or username already taken", "ERR_CONFLICT")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if h.email.Enabled() {
		code := generateVerifyCode()
		expires := time.Now().Add(24 * time.Hour)
		if err := h.store.SetVerifyCode(r.Context(), req.Email, code, expires); err != nil {
			httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
			return
		}
		go h.email.SendVerification(req.Email, req.Username, code)
		httputil.JSON(w, http.StatusCreated, map[string]any{"verification_required": true})
		return
	}

	token, err := GenerateToken(user.ID.String(), user.Username, h.secret)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusCreated, authResponse{
		Token: token,
		User:  userResponse{ID: user.ID.String(), Email: user.Email, Username: user.Username},
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, "invalid request body", "ERR_BAD_REQUEST")
		return
	}
	if req.Email == "" || req.Password == "" {
		httputil.Error(w, http.StatusBadRequest, "email and password are required", "ERR_VALIDATION")
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusUnauthorized, "invalid credentials", "ERR_UNAUTHORIZED")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		httputil.Error(w, http.StatusUnauthorized, "invalid credentials", "ERR_UNAUTHORIZED")
		return
	}

	if !user.EmailVerified && h.email.Enabled() {
		httputil.Error(w, http.StatusForbidden, "email not verified", "ERR_EMAIL_NOT_VERIFIED")
		return
	}

	token, err := GenerateToken(user.ID.String(), user.Username, h.secret)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, authResponse{
		Token: token,
		User:  userResponse{ID: user.ID.String(), Email: user.Email, Username: user.Username},
	})
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || req.Code == "" {
		httputil.Error(w, http.StatusBadRequest, "email and code are required", "ERR_VALIDATION")
		return
	}

	user, err := h.store.VerifyEmailCode(r.Context(), req.Email, req.Code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusUnauthorized, "invalid or expired code", "ERR_INVALID_CODE")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	token, err := GenerateToken(user.ID.String(), user.Username, h.secret)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	httputil.JSON(w, http.StatusOK, authResponse{
		Token: token,
		User:  userResponse{ID: user.ID.String(), Email: user.Email, Username: user.Username},
	})
}

func (h *Handler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		httputil.Error(w, http.StatusBadRequest, "email is required", "ERR_VALIDATION")
		return
	}

	if !h.email.Enabled() {
		httputil.Error(w, http.StatusServiceUnavailable, "email service not configured", "ERR_NO_EMAIL")
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		// Don't reveal whether the email exists
		httputil.JSON(w, http.StatusOK, map[string]string{"message": "if the email exists, a new code was sent"})
		return
	}
	if user.EmailVerified {
		httputil.JSON(w, http.StatusOK, map[string]string{"message": "already verified"})
		return
	}

	code := generateVerifyCode()
	expires := time.Now().Add(24 * time.Hour)
	if err := h.store.SetVerifyCode(r.Context(), req.Email, code, expires); err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}
	go h.email.SendVerification(req.Email, user.Username, code)
	httputil.JSON(w, http.StatusOK, map[string]string{"message": "code sent"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	user, err := h.store.GetUserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httputil.Error(w, http.StatusNotFound, "user not found", "ERR_NOT_FOUND")
			return
		}
		httputil.Error(w, http.StatusInternalServerError, "internal error", "ERR_INTERNAL")
		return
	}

	httputil.JSON(w, http.StatusOK, userResponse{
		ID:       user.ID.String(),
		Email:    user.Email,
		Username: user.Username,
	})
}
