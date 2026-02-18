package models

import "time"

type Document struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	OwnerName string    `json:"owner_name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Collaborator struct {
	ID         int       `json:"id"`
	DocumentID string    `json:"document_id"`
	UserName   string    `json:"user_name"`
	Permission string    `json:"permission"`
	AddedAt    time.Time `json:"added_at"`
}

type CreateDocumentRequest struct {
	Title     string `json:"title"`
	OwnerName string `json:"owner_name"`
}

type UpdateDocumentRequest struct {
	Title string `json:"title"`
}

type ShareDocumentRequest struct {
	Email      string `json:"email"`
	Permission string `json:"permission"`
}

type ActivityLog struct {
	ID         int       `json:"id"`
	DocumentID string    `json:"document_id"`
	UserName   string    `json:"user_name"`
	Action     string    `json:"action"`
	Details    string    `json:"details"`
	CreatedAt  time.Time `json:"created_at"`
}

type DocumentWithPermission struct {
	Document
	Permission string `json:"permission"`
}
