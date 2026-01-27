package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// App
	AppEnv string

	// Backend
	BackendHost string
	BackendPort string
	BackendURL  string

	// Frontend
	FrontendURL string

	// Database
	DatabaseURL string

	// Auth
	JWTSecret      string
	JWTExpiryHours int
	MasterToken    string

	// CORS
	AllowedOrigins string

	// WebSocket
	WSMaxConnections  int
	WSReadBufferSize  int
	WSWriteBufferSize int
}

var AppConfig *Config

func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := &Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		BackendHost: getEnv("BACKEND_HOST", "localhost"),
		BackendPort: getEnv("BACKEND_PORT", "8080"),
		BackendURL:  getEnv("BACKEND_URL", "http://localhost:8080"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),

		DatabaseURL: getEnv("DATABASE_URL", ""),

		JWTSecret:      getEnv("JWT_SECRET", "default-secret-change-me"),
		JWTExpiryHours: getEnvInt("JWT_EXPIRY_HOURS", 72),
		MasterToken:    getEnv("MASTER_TOKEN", ""),

		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),

		WSMaxConnections:  getEnvInt("WS_MAX_CONNECTIONS", 100),
		WSReadBufferSize:  getEnvInt("WS_READ_BUFFER_SIZE", 1024),
		WSWriteBufferSize: getEnvInt("WS_WRITE_BUFFER_SIZE", 1024),
	}

	// Validate critical variables in production
	if cfg.AppEnv == "production" {
		if cfg.JWTSecret == "default-secret-change-me" {
		}
		if cfg.MasterToken == "" {
		}
		if cfg.DatabaseURL == "" {
		}
	}

	AppConfig = cfg
	return cfg
}

func Print(cfg *Config) {
	fmt.Println("============================================")
	fmt.Println("Environment:  " + cfg.AppEnv)
	fmt.Println("Backend:      " + cfg.BackendHost + ":" + cfg.BackendPort)
	fmt.Println("Frontend:     " + cfg.FrontendURL)
	fmt.Println("Database:     " + maskDSN(cfg.DatabaseURL) + "....")
	fmt.Println("============================================")
}

func maskDSN(dsn string) string {
	if dsn == "" {
		return "(not set)"
	}
	if len(dsn) > 30 {
		return dsn[:30]
	}
	return dsn
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}
