package models

import "time"

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ShareLink struct {
	ID         int       `json:"id"`
	DocumentID string    `json:"document_id"`
	Token      string    `json:"token"`
	Permission string    `json:"permission"`
	CreatedBy  string    `json:"created_by"`
	CreatedAt  time.Time `json:"created_at"`
	URL        string    `json:"url,omitempty"`
}

type CreateShareLinkRequest struct {
	Permission string `json:"permission"`
}

type ShareLinkResponse struct {
	DocumentID string `json:"document_id"`
	Title      string `json:"title"`
	Permission string `json:"permission"`
	OwnerName  string `json:"owner_name"`
}
