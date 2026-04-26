package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/zzzpize/dndgo/backend/internal/httputil"
)

type contextKey string

const claimsKey contextKey = "claims"

func JWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httputil.Error(w, http.StatusUnauthorized, "missing or invalid token", "ERR_UNAUTHORIZED")
				return
			}
			claims, err := ValidateToken(strings.TrimPrefix(header, "Bearer "), secret)
			if err != nil {
				httputil.Error(w, http.StatusUnauthorized, "invalid token", "ERR_UNAUTHORIZED")
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsKey).(*Claims)
	return c, ok
}
