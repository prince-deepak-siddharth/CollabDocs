package handlers

import (
	"net/http"
	"strings"

	"github.com/collabdocs/config"
)

// MasterAuthMiddleware validates the master token for admin routes
func MasterAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		masterToken := config.AppConfig.MasterToken
		if masterToken == "" {
			http.Error(w, `{"error":"Master token not configured"}`, http.StatusInternalServerError)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"Missing Authorization header"}`, http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token != masterToken {
			http.Error(w, `{"error":"Invalid master token"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
