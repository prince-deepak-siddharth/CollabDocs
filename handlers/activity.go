package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/collabdocs/db"
	"github.com/collabdocs/models"
	"github.com/gorilla/mux"
)

// LogActivity inserts an activity log entry for a document.
func LogActivity(docID, userName, action, details string) {
	_, err := db.DB.Exec(
		`INSERT INTO activity_log (document_id, user_name, action, details) VALUES ($1, $2, $3, $4)`,
		docID, userName, action, details,
	)
	if err != nil {
		log.Printf("Failed to log activity: %v", err)
	}
}

// GetUserPermission returns the permission level for a user on a document.
// Returns "owner", "edit", "view", "comment", or "none".
func GetUserPermission(docID, userName string) string {
	// Check if owner
	var ownerName string
	err := db.DB.QueryRow(`SELECT owner_name FROM documents WHERE id = $1`, docID).Scan(&ownerName)
	if err != nil {
		return "none"
	}
	if ownerName == userName {
		return "owner"
	}

	// Check collaborator table
	var permission string
	err = db.DB.QueryRow(
		`SELECT permission FROM collaborators WHERE document_id = $1 AND user_name = $2`,
		docID, userName,
	).Scan(&permission)
	if err != nil {
		return "none"
	}
	return permission
}

// GetActivityLog returns the activity log for a document.
func GetActivityLog(w http.ResponseWriter, r *http.Request) {
	docID := mux.Vars(r)["id"]
	user := r.Context().Value(UserContextKey).(*models.User)

	// Check user has access
	perm := GetUserPermission(docID, user.Username)
	if perm == "none" {
		http.Error(w, `{"error":"Access denied"}`, http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(
		`SELECT id, document_id, user_name, action, details, created_at
		 FROM activity_log WHERE document_id = $1
		 ORDER BY created_at DESC LIMIT 100`,
		docID,
	)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch activity log"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	logs := []models.ActivityLog{}
	for rows.Next() {
		var entry models.ActivityLog
		if err := rows.Scan(&entry.ID, &entry.DocumentID, &entry.UserName, &entry.Action, &entry.Details, &entry.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, entry)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
