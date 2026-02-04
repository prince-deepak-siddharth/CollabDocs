package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/collabdocs/handlers"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var userColors = []string{
	"#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
	"#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
	"#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
}

var colorIndex int

type Client struct {
	Hub        *Hub
	Conn       *websocket.Conn
	Send       chan *Message
	DocID      string
	UserName   string
	Color      string
	Permission string // "owner", "edit", "view", "comment"
}

type IncomingMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	docID := r.URL.Query().Get("doc_id")
	userName := r.URL.Query().Get("user_name")

	if docID == "" || userName == "" {
		http.Error(w, "doc_id and user_name are required", http.StatusBadRequest)
		return
	}

	// Check user's permission on this document
	permission := handlers.GetUserPermission(docID, userName)

	// Also check if they have a share-link based permission
	// (for guests who enter via share link without being a registered collaborator)
	if permission == "none" {
		// For share-link users, they might not be in collaborators table
		// but the frontend will have passed them through the share-link flow.
		// Allow "view" by default for share-link guests to enable WebSocket presence.
		// The readPump will still block write operations.
		permission = "view"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	color := userColors[colorIndex%len(userColors)]
	colorIndex++

	client := &Client{
		Hub:        hub,
		Conn:       conn,
		Send:       make(chan *Message, 256),
		DocID:      docID,
		UserName:   userName,
		Color:      color,
		Permission: permission,
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512KB
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, msgBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var incoming IncomingMessage
		if err := json.Unmarshal(msgBytes, &incoming); err != nil {
			log.Println("Failed to parse message:", err)
			continue
		}

		switch incoming.Type {
		case "delta":
			// Only allow edits from users with edit/owner permission
			if c.Permission != "edit" && c.Permission != "owner" {
				log.Printf("WebSocket: user %s attempted delta without edit permission (has: %s)", c.UserName, c.Permission)
				continue
			}
			// Broadcast delta to other clients in the room
			c.Hub.broadcast <- &Message{
				DocID:  c.DocID,
				Type:   "delta",
				Data:   json.RawMessage(incoming.Data),
				Sender: c,
			}

		case "cursor":
			// Allow all users to share cursor position
			c.Hub.broadcast <- &Message{
				DocID: c.DocID,
				Type:  "cursor",
				Data: map[string]interface{}{
					"user_name": c.UserName,
					"color":     c.Color,
					"range":     json.RawMessage(incoming.Data),
				},
				Sender: c,
			}

		case "save":
			// Only allow saves from users with edit/owner permission
			if c.Permission != "edit" && c.Permission != "owner" {
				log.Printf("WebSocket: user %s attempted save without edit permission (has: %s)", c.UserName, c.Permission)
				continue
			}
			// Save document content to database
			var contentStr string
			if err := json.Unmarshal(incoming.Data, &contentStr); err != nil {
				// Try treating it as raw JSON
				contentStr = string(incoming.Data)
			}
			if err := handlers.SaveDocumentContent(c.DocID, contentStr, c.UserName); err != nil {
				log.Printf("Failed to save document %s: %v", c.DocID, err)
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			msgBytes, err := json.Marshal(message)
			if err != nil {
				log.Println("Failed to marshal message:", err)
				continue
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
