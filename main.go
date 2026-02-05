package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/collabdocs/config"
	"github.com/collabdocs/db"
	"github.com/collabdocs/handlers"
	"github.com/collabdocs/ws"
	"github.com/gorilla/mux"
)

func main() {
	// Load configuration from .env
	cfg := config.Load()
	config.Print(cfg)

	// Initialize database
	db.Init()

	// Initialize WebSocket hub
	hub := ws.NewHub()
	ws.GlobalHub = hub
	go hub.Run()

	// Setup router
	r := mux.NewRouter()

	// ---- Admin routes (master token required) ----
	r.Handle("/api/admin/health", handlers.MasterAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","env":"` + cfg.AppEnv + `"}`))
	}))).Methods("GET", "OPTIONS")

	// ---- Public routes (no auth required) ----
	r.HandleFunc("/api/auth/register", handlers.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/login", handlers.Login).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/share-links/{token}", handlers.GetShareLinkByToken).Methods("GET", "OPTIONS")
	// GetDocument handles auth internally (supports both JWT and share-link tokens)
	r.HandleFunc("/api/documents/{id}", handlers.GetDocument).Methods("GET", "OPTIONS")

	// WebSocket
	r.HandleFunc("/ws", func(w http.ResponseWriter, rr *http.Request) {
		ws.ServeWs(hub, w, rr)
	})

	// ---- Protected routes (JWT required) ----
	r.Handle("/api/auth/me", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetMe))).Methods("GET", "OPTIONS")
	r.Handle("/api/documents", handlers.AuthMiddleware(http.HandlerFunc(handlers.CreateDocument))).Methods("POST", "OPTIONS")
	r.Handle("/api/documents", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetDocuments))).Methods("GET", "OPTIONS")
	r.Handle("/api/documents/{id}", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateDocument))).Methods("PUT", "OPTIONS")
	r.Handle("/api/documents/{id}", handlers.AuthMiddleware(http.HandlerFunc(handlers.DeleteDocument))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/documents/{id}/share", handlers.AuthMiddleware(http.HandlerFunc(handlers.ShareDocument))).Methods("POST", "OPTIONS")
	r.Handle("/api/documents/{id}/collaborators", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetCollaborators))).Methods("GET", "OPTIONS")
	r.Handle("/api/documents/{id}/share-links", handlers.AuthMiddleware(http.HandlerFunc(handlers.CreateShareLink))).Methods("POST", "OPTIONS")
	r.Handle("/api/documents/{id}/share-links", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetDocumentShareLinks))).Methods("GET", "OPTIONS")
	r.Handle("/api/documents/{id}/share-links/{linkId}", handlers.AuthMiddleware(http.HandlerFunc(handlers.DeleteShareLink))).Methods("DELETE", "OPTIONS")
	r.Handle("/api/documents/{id}/activity", handlers.AuthMiddleware(http.HandlerFunc(handlers.GetActivityLog))).Methods("GET", "OPTIONS")

	// CORS middleware
	handler := corsMiddleware(r, cfg)

	fmt.Printf("🚀 API server running on http://%s:%s\n", cfg.BackendHost, cfg.BackendPort)
	log.Fatal(http.ListenAndServe(":"+cfg.BackendPort, handler))
}

func corsMiddleware(next http.Handler, cfg *config.Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if cfg.AppEnv == "production" {
			// In production, only allow configured origins
			allowed := false
			for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
				if strings.TrimSpace(o) == origin {
					allowed = true
					break
				}
			}
			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
		} else {
			// In development, allow any origin
			if origin == "" {
				origin = "*"
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
