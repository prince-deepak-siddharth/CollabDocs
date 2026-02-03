package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/collabdocs/db"
	"github.com/collabdocs/models"
	"github.com/gorilla/mux"
)

func CreateDocument(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(UserContextKey).(*models.User)

	var req models.CreateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		req.Title = "Untitled Document"
	}

	var doc models.Document
	err := db.DB.QueryRow(
		`INSERT INTO documents (title, owner_name) VALUES ($1, $2)
		 RETURNING id, title, content, owner_name, created_at, updated_at`,
		req.Title, user.Username,
	).Scan(&doc.ID, &doc.Title, &doc.Content, &doc.OwnerName, &doc.CreatedAt, &doc.UpdatedAt)

	if err != nil {
		http.Error(w, `{"error":"Failed to create document"}`, http.StatusInternalServerError)
		return
	}

	LogActivity(doc.ID, user.Username, "create", "Created document")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(doc)
}

func GetDocuments(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(UserContextKey).(*models.User)

	query := `
		SELECT DISTINCT d.id, d.title, d.content, d.owner_name, d.created_at, d.updated_at
		FROM documents d
		LEFT JOIN collaborators c ON d.id = c.document_id
		WHERE d.owner_name = $1 OR c.user_name = $1
		ORDER BY d.updated_at DESC
	`

	rows, err := db.DB.Query(query, user.Username)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch documents"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	docs := []models.Document{}
	for rows.Next() {
		var doc models.Document
		if err := rows.Scan(&doc.ID, &doc.Title, &doc.Content, &doc.OwnerName, &doc.CreatedAt, &doc.UpdatedAt); err != nil {
			continue
		}
		docs = append(docs, doc)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

// GetDocument returns a document with the caller's permission level.
// Supports both authenticated users (via JWT) and share-link tokens (?token=...).
func GetDocument(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	var doc models.Document
	err := db.DB.QueryRow(
		`SELECT id, title, content, owner_name, created_at, updated_at FROM documents WHERE id = $1`,
		id,
	).Scan(&doc.ID, &doc.Title, &doc.Content, &doc.OwnerName, &doc.CreatedAt, &doc.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Document not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch document"}`, http.StatusInternalServerError)
		return
	}

	// Determine permission
	permission := "none"

	// Check share-link token first (for unauthenticated/shared access)
	tokenParam := r.URL.Query().Get("token")
	if tokenParam != "" {
		var linkPerm string
		err := db.DB.QueryRow(
			`SELECT permission FROM share_links WHERE token = $1 AND document_id = $2`,
			tokenParam, id,
		).Scan(&linkPerm)
		if err == nil {
			permission = linkPerm
		}
	}

	// Check authenticated user (overrides share-link if higher)
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			username := getUsernameFromToken(parts[1])
			if username != "" {
				userPerm := GetUserPermission(id, username)
				if userPerm != "none" {
					permission = userPerm
				}
			}
		}
	}

	if permission == "none" {
		http.Error(w, `{"error":"Access denied. You need permission to view this document."}`, http.StatusForbidden)
		return
	}

	resp := models.DocumentWithPermission{
		Document:   doc,
		Permission: permission,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func UpdateDocument(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Check permission
	perm := GetUserPermission(id, user.Username)
	if perm != "owner" && perm != "edit" {
		http.Error(w, `{"error":"You don't have permission to edit this document"}`, http.StatusForbidden)
		return
	}

	var req models.UpdateDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	var doc models.Document
	err := db.DB.QueryRow(
		`UPDATE documents SET title = $1, updated_at = NOW() WHERE id = $2
		 RETURNING id, title, content, owner_name, created_at, updated_at`,
		req.Title, id,
	).Scan(&doc.ID, &doc.Title, &doc.Content, &doc.OwnerName, &doc.CreatedAt, &doc.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Document not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"Failed to update document"}`, http.StatusInternalServerError)
		return
	}

	LogActivity(id, user.Username, "title_change", fmt.Sprintf("Changed title to \"%s\"", req.Title))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func DeleteDocument(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	result, err := db.DB.Exec(`DELETE FROM documents WHERE id = $1 AND owner_name = $2`, id, user.Username)
	if err != nil {
		http.Error(w, `{"error":"Failed to delete document"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"error":"Document not found or access denied"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Document deleted"})
}

func ShareDocument(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Only owner can share
	perm := GetUserPermission(id, user.Username)
	if perm != "owner" {
		http.Error(w, `{"error":"Only the document owner can share"}`, http.StatusForbidden)
		return
	}

	var req models.ShareDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" {
		http.Error(w, `{"error":"Email is required"}`, http.StatusBadRequest)
		return
	}

	if req.Permission == "" {
		req.Permission = "edit"
	}

	// Look up user by email
	var targetUsername string
	err := db.DB.QueryRow(`SELECT username FROM users WHERE email = $1`, req.Email).Scan(&targetUsername)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"No user found with this email"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"Failed to look up user"}`, http.StatusInternalServerError)
		return
	}

	// Check if document exists
	var ownerName string
	err = db.DB.QueryRow(`SELECT owner_name FROM documents WHERE id = $1`, id).Scan(&ownerName)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Document not found"}`, http.StatusNotFound)
		return
	}

	// Don't share with the owner
	if strings.EqualFold(targetUsername, ownerName) {
		http.Error(w, `{"error":"Cannot share with the document owner"}`, http.StatusBadRequest)
		return
	}

	var collab models.Collaborator
	err = db.DB.QueryRow(
		`INSERT INTO collaborators (document_id, user_name, permission)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (document_id, user_name) DO UPDATE SET permission = $3
		 RETURNING id, document_id, user_name, permission, added_at`,
		id, targetUsername, req.Permission,
	).Scan(&collab.ID, &collab.DocumentID, &collab.UserName, &collab.Permission, &collab.AddedAt)

	if err != nil {
		http.Error(w, `{"error":"Failed to share document"}`, http.StatusInternalServerError)
		return
	}

	LogActivity(id, user.Username, "share", fmt.Sprintf("Shared with %s (%s)", req.Email, req.Permission))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(collab)
}

func GetCollaborators(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Only owner can view collaborators
	perm := GetUserPermission(id, user.Username)
	if perm != "owner" {
		http.Error(w, `{"error":"Only the document owner can view collaborators"}`, http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(
		`SELECT id, document_id, user_name, permission, added_at FROM collaborators WHERE document_id = $1`,
		id,
	)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch collaborators"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	collabs := []models.Collaborator{}
	for rows.Next() {
		var c models.Collaborator
		if err := rows.Scan(&c.ID, &c.DocumentID, &c.UserName, &c.Permission, &c.AddedAt); err != nil {
			continue
		}
		collabs = append(collabs, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(collabs)
}

func SaveDocumentContent(docID string, content string, userName string) error {
	_, err := db.DB.Exec(
		`UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2`,
		content, docID,
	)
	if err == nil && userName != "" {
		LogActivity(docID, userName, "edit", "Edited document content")
	}
	return err
}

// getUsernameFromToken extracts the username from a JWT token string.
func getUsernameFromToken(tokenStr string) string {
	claims, err := parseToken(tokenStr)
	if err != nil {
		return ""
	}
	return claims.Subject
}
