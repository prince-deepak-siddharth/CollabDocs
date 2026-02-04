package ws

import (
	"log"
	"sync"
)

type Hub struct {
	rooms      map[string]map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type Message struct {
	DocID  string      `json:"doc_id"`
	Type   string      `json:"type"`
	Data   interface{} `json:"data"`
	Sender *Client     `json:"-"`
}

var GlobalHub *Hub

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan *Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[client.DocID]; !ok {
				h.rooms[client.DocID] = make(map[*Client]bool)
			}
			h.rooms[client.DocID][client] = true
			h.mu.Unlock()

			log.Printf("👤 %s joined document %s", client.UserName, client.DocID)

			// Notify all clients in the room about the new user
			h.broadcastUserList(client.DocID)

		case client := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[client.DocID]; ok {
				if _, ok := room[client]; ok {
					delete(room, client)
					close(client.Send)
					if len(room) == 0 {
						delete(h.rooms, client.DocID)
					}
				}
			}
			h.mu.Unlock()

			log.Printf("👤 %s left document %s", client.UserName, client.DocID)

			// Notify remaining clients
			h.broadcastUserList(client.DocID)

		case message := <-h.broadcast:
			h.mu.RLock()
			if room, ok := h.rooms[message.DocID]; ok {
				for client := range room {
					if client != message.Sender {
						select {
						case client.Send <- message:
						default:
							close(client.Send)
							delete(room, client)
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) broadcastUserList(docID string) {
	h.mu.RLock()
	room, ok := h.rooms[docID]
	if !ok {
		h.mu.RUnlock()
		return
	}

	users := []map[string]string{}
	seen := map[string]bool{}
	for client := range room {
		if !seen[client.UserName] {
			seen[client.UserName] = true
			users = append(users, map[string]string{
				"user_name": client.UserName,
				"color":     client.Color,
			})
		}
	}
	h.mu.RUnlock()

	msg := &Message{
		DocID: docID,
		Type:  "users",
		Data:  users,
	}

	h.mu.RLock()
	if room, ok := h.rooms[docID]; ok {
		for client := range room {
			select {
			case client.Send <- msg:
			default:
			}
		}
	}
	h.mu.RUnlock()
}
