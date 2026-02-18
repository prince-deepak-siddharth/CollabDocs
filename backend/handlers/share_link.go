package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/collabdocs/db"
	"github.com/collabdocs/models"
	"github.com/gorilla/mux"
)

func CreateShareLink(w http.ResponseWriter, r *http.Request) {
	docID := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	var req models.CreateShareLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate permission
	perm := req.Permission
	if perm != "view" && perm != "edit" && perm != "comment" {
		perm = "view"
	}

	// Check document ownership or edit access
	var ownerName string
	err := db.DB.QueryRow(`SELECT owner_name FROM documents WHERE id = $1`, docID).Scan(&ownerName)
	if err != nil {
		http.Error(w, `{"error":"Document not found"}`, http.StatusNotFound)
		return
	}

	if ownerName != user.Username {
		http.Error(w, `{"error":"Only the owner can create share links"}`, http.StatusForbidden)
		return
	}

	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		http.Error(w, `{"error":"Failed to generate token"}`, http.StatusInternalServerError)
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Insert share link
	var link models.ShareLink
	err = db.DB.QueryRow(
		`INSERT INTO share_links (document_id, token, permission, created_by)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, document_id, token, permission, created_by, created_at`,
		docID, token, perm, user.Username,
	).Scan(&link.ID, &link.DocumentID, &link.Token, &link.Permission, &link.CreatedBy, &link.CreatedAt)

	if err != nil {
		http.Error(w, `{"error":"Failed to create share link"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(link)
}

func GetShareLinkByToken(w http.ResponseWriter, r *http.Request) {
	token := mux.Vars(r)["token"]

	var resp models.ShareLinkResponse
	var docID string
	err := db.DB.QueryRow(
		`SELECT sl.document_id, sl.permission, d.title, d.owner_name
		 FROM share_links sl
		 JOIN documents d ON sl.document_id = d.id
		 WHERE sl.token = $1`,
		token,
	).Scan(&docID, &resp.Permission, &resp.Title, &resp.OwnerName)

	if err != nil {
		http.Error(w, `{"error":"Invalid or expired share link"}`, http.StatusNotFound)
		return
	}

	resp.DocumentID = docID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func GetDocumentShareLinks(w http.ResponseWriter, r *http.Request) {
	docID := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Check ownership
	var ownerName string
	err := db.DB.QueryRow(`SELECT owner_name FROM documents WHERE id = $1`, docID).Scan(&ownerName)
	if err != nil {
		http.Error(w, `{"error":"Document not found"}`, http.StatusNotFound)
		return
	}

	if ownerName != user.Username {
		http.Error(w, `{"error":"Only the owner can view share links"}`, http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(
		`SELECT id, document_id, token, permission, created_by, created_at
		 FROM share_links WHERE document_id = $1 ORDER BY created_at DESC`,
		docID,
	)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch share links"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	links := []models.ShareLink{}
	for rows.Next() {
		var link models.ShareLink
		if err := rows.Scan(&link.ID, &link.DocumentID, &link.Token, &link.Permission, &link.CreatedBy, &link.CreatedAt); err != nil {
			continue
		}
		links = append(links, link)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(links)
}

func DeleteShareLink(w http.ResponseWriter, r *http.Request) {
	linkID := mux.Vars(r)["linkId"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Verify ownership via join
	result, err := db.DB.Exec(
		`DELETE FROM share_links sl
		 USING documents d
		 WHERE sl.document_id = d.id AND sl.id = $1 AND d.owner_name = $2`,
		linkID, user.Username,
	)
	if err != nil {
		http.Error(w, `{"error":"Failed to delete share link"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"error":"Share link not found or access denied"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Share link deleted"})
}
