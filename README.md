# CollabDocs

> **A real-time collaborative document editor** -- Think Google Docs, but self-hosted. Multiple users can edit documents simultaneously with live cursor tracking, role-based permissions, and shareable links.

<p align="center">
  <img src="frontend/public/logo.png" alt="CollabDocs Logo" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/WebSocket-Live-brightgreen?logo=websocket" alt="WebSocket" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [System Workflow](#system-workflow)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## Features

| Category | Feature |
|----------|---------|
| **Documents** | Create, edit, rename & delete rich-text documents |
| **Real-Time Sync** | Live collaborative editing via WebSocket with OT-style delta broadcasting |
| **Live Cursors** | See other users' cursor positions in real-time with assigned colors |
| **Authentication** | JWT-based register/login with bcrypt password hashing |
| **Permissions** | Role-based access -- Owner, Edit, View, Comment |
| **Share Links** | Generate shareable URLs with customizable permission levels |
| **Email Sharing** | Share documents directly with registered users by email |
| **Activity Log** | Full audit trail of all document actions |
| **Dark Mode** | System-aware theme toggle with persistence |
| **Admin API** | Master token protected admin endpoints |
| **Responsive** | Works across desktop and mobile viewports |

---

## Tech Stack

```mermaid
flowchart TD
    subgraph FRONTEND
        A["Next.js 16 | React 19 | TypeScript 5 | Quill 2"]
    end

    subgraph BACKEND
        B["Go 1.25 | Gorilla Mux | Gorilla WebSocket | JWT"]
    end

    subgraph DATABASE
        C["PostgreSQL | UUID-OSSP"]
    end

    A --> B
    B --> C
```

---

## Architecture Overview

```mermaid
graph TD
    Browser["Browser<br/>Next.js"]

    Browser -->|"HTTP REST<br/>Port 3000 proxied"| Router["API Router<br/>Gorilla Mux"]
    Browser -->|"WebSocket<br/>wss://"| Hub["WebSocket Hub<br/>Room-based"]

    Router --> Auth["Auth Handler"]
    Router --> Docs["Docs Handler"]
    Router --> Share["Share Handler"]

    Auth --> DB[("PostgreSQL")]
    Docs --> DB
    Share --> DB
    Hub --> DB

    subgraph Tables
        T1["users"]
        T2["documents"]
        T3["collaborators"]
        T4["share_links"]
        T5["activity_log"]
    end

    DB --- T1
    DB --- T2
    DB --- T3
    DB --- T4
    DB --- T5
```

---

## System Workflow

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: Enter credentials
    Frontend->>Backend: POST /api/auth/register or /login
    Backend->>Database: bcrypt hash + store
    Database-->>Backend: OK
    Backend-->>Frontend: { token, user }
    Frontend->>Frontend: Store JWT in localStorage
    Frontend-->>User: Redirect to Dashboard
```

### Document Editing Flow (Real-Time Collaboration)

```mermaid
sequenceDiagram
    participant A as User A (Editor)
    participant Hub as WebSocket Hub
    participant B as User B (Viewer)

    A->>Hub: Connect WS (?doc_id=X&user_name=A)
    B->>Hub: Connect WS (?doc_id=X&user_name=B)
    Hub-->>A: { type: "users", [...] }
    Hub-->>B: { type: "users", [...] }

    A->>Hub: { type: "delta", data: quill_delta }
    Hub-->>B: Broadcast delta
    Note right of B: Apply delta to Quill

    A->>Hub: { type: "cursor", data: selection }
    Hub-->>B: Broadcast cursor
    Note right of B: Show cursor position

    A->>Hub: { type: "save", data: full_content }
    Hub->>Hub: Save to PostgreSQL
```

### Share Link Flow

```mermaid
sequenceDiagram
    participant Owner
    participant Backend
    participant Guest

    Owner->>Backend: POST /api/documents/{id}/share-links
    Backend->>Backend: Generate 32-byte random hex token
    Backend-->>Owner: { token: "abc..." }
    Owner->>Guest: Copy & send link /shared/abc...
    Guest->>Backend: GET /api/share-links/abc...
    Backend-->>Guest: { doc_id, permission, title }
    Guest->>Guest: Enter username
    Guest->>Backend: Connect WebSocket
    Note over Owner, Guest: Collaborate!
```

### Permission Hierarchy

```mermaid
graph TD
    OWNER["OWNER<br/>Read | Edit | Delete | Share | Manage"]
    EDIT_ROLE["EDIT<br/>Read | Edit"]
    COMMENT_ROLE["COMMENT<br/>Read"]
    VIEW_ROLE["VIEW<br/>Read"]

    OWNER -.->|inherits| EDIT_ROLE
    EDIT_ROLE -.->|inherits| COMMENT_ROLE
    COMMENT_ROLE -.->|inherits| VIEW_ROLE
```

---

## Database Schema

```mermaid
erDiagram
    users {
        int id PK
        varchar username "unique"
        varchar email "unique"
        varchar password_hash
        timestamp created_at
    }

    documents {
        uuid id PK
        varchar title
        jsonb content
        varchar owner_name
        timestamp created_at
        timestamp updated_at
    }

    collaborators {
        int id PK
        uuid document_id FK
        varchar user_name
        varchar permission
        timestamp added_at
    }

    sharelinks {
        int id PK
        uuid document_id FK
        varchar token "unique"
        varchar permission
        varchar created_by
        timestamp created_at
    }

    activitylog {
        int id PK
        uuid document_id FK
        varchar user_name
        varchar action
        text details
        timestamp created_at
    }

    documents ||--o{ collaborators : "has"
    documents ||--o{ sharelinks : "has"
    documents ||--o{ activitylog : "has"
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | -- | Register a new user |
| `POST` | `/api/auth/login` | -- | Login and receive JWT |
| `GET` | `/api/auth/me` | JWT | Get current user info |

### Documents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/documents` | JWT | Create new document |
| `GET` | `/api/documents` | JWT | List user's documents (owned + shared) |
| `GET` | `/api/documents/:id` | JWT / Token | Get document by ID |
| `PUT` | `/api/documents/:id` | JWT | Update document title |
| `DELETE` | `/api/documents/:id` | JWT | Delete document (owner only) |

### Sharing and Collaboration

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/documents/:id/share` | JWT | Share document by email |
| `GET` | `/api/documents/:id/collaborators` | JWT | List collaborators |
| `POST` | `/api/documents/:id/share-links` | JWT | Create a share link |
| `GET` | `/api/documents/:id/share-links` | JWT | List share links |
| `DELETE` | `/api/documents/:id/share-links/:linkId` | JWT | Revoke a share link |
| `GET` | `/api/share-links/:token` | -- | Resolve share link token |

### Activity

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/documents/:id/activity` | JWT | Get activity log (last 100) |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/health` | Master Token | Health check |

---

## WebSocket Protocol

**Connection:** `ws(s)://<host>/ws?doc_id=<uuid>&user_name=<name>`

### Message Types

| Direction | Type | Payload | Permission |
|-----------|------|---------|------------|
| Client to Server | `delta` | `{ type: "delta", data: <quill_delta> }` | owner / edit |
| Client to Server | `cursor` | `{ type: "cursor", data: <selection_range> }` | all users |
| Client to Server | `save` | `{ type: "save", data: "<full_content_json>" }` | owner / edit |
| Server to Client | `delta` | Broadcast of another user's text change | -- |
| Server to Client | `cursor` | Another user's cursor position + color | -- |
| Server to Client | `users` | `[{ user_name, color }, ...]` | -- |

### Connection Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Client->>Server: HTTP Upgrade to WebSocket
    Server->>Server: Verify permission
    Server->>Server: Assign color (#FF6B6B, #4ECDC4, ...)
    Server->>Server: Register in room
    Server-->>Client: { type: "users", [...] }
    Note over Client, Server: Active session (bidirectional)

    loop Keepalive
        Server-->>Client: PING (every 30s)
        Client-->>Server: PONG (within 60s)
    end

    Client->>Server: Connection closed / lost
    Server->>Server: Unregister from room
    Server-->>Client: { type: "users", [...] } (to remaining clients)
```

---

## Getting Started

### Prerequisites

- **Go** >= 1.25
- **Node.js** >= 20
- **PostgreSQL** >= 14
- **npm** or **yarn**

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/collabdocs.git
cd collabdocs
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# App
APP_ENV=development

# Backend
BACKEND_HOST=localhost
BACKEND_PORT=8080
BACKEND_URL=http://localhost:8080

# Frontend
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgres://user:password@localhost:5432/collabdocs?sslmode=disable

# Auth
JWT_SECRET=your-super-secret-key-change-me
JWT_EXPIRY_HOURS=72
MASTER_TOKEN=your-admin-master-token

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# WebSocket
WS_MAX_CONNECTIONS=100
WS_READ_BUFFER_SIZE=1024
WS_WRITE_BUFFER_SIZE=1024
```

Sync environment to the frontend:

```bash
chmod +x backend/sync-env.sh && ./backend/sync-env.sh
```

### 3. Set Up the Database

```bash
# Create the PostgreSQL database
createdb collabdocs

# Tables are auto-created on first server start
```

### 4. Start the Backend

```bash
cd backend
go mod download
go run main.go
```

The API server will start at `http://localhost:8080`

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:3000`

### 6. Open in Browser

Navigate to **http://localhost:3000** -- register an account and start collaborating!

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | App environment (`development` / `production`) |
| `BACKEND_HOST` | `localhost` | Backend bind host |
| `BACKEND_PORT` | `8080` | Backend bind port |
| `BACKEND_URL` | `http://localhost:8080` | Full backend URL |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL (for CORS) |
| `DATABASE_URL` | -- | PostgreSQL connection string |
| `JWT_SECRET` | `default-secret-change-me` | Secret for JWT signing (HS256) |
| `JWT_EXPIRY_HOURS` | `72` | JWT token lifetime in hours |
| `MASTER_TOKEN` | -- | Admin API authentication token |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `WS_MAX_CONNECTIONS` | `100` | Max concurrent WebSocket connections |
| `WS_READ_BUFFER_SIZE` | `1024` | WebSocket read buffer (bytes) |
| `WS_WRITE_BUFFER_SIZE` | `1024` | WebSocket write buffer (bytes) |

---

## Project Structure

```
collabdocs/
|
|-- backend/                     # Go API server
|   |-- main.go                  # Entry point -- HTTP server, router, CORS
|   |-- go.mod                   # Go module and dependencies
|   |-- .env.example             # Environment variable template
|   |-- sync-env.sh              # Syncs backend .env to frontend/.env.local
|   |
|   |-- config/
|   |   +-- config.go            # Centralized config loader (.env + env vars)
|   |
|   |-- db/
|   |   +-- database.go          # PostgreSQL connection and auto-migration
|   |
|   |-- models/
|   |   |-- user.go              # User, auth request/response structs
|   |   +-- document.go          # Document, collaborator, share structs
|   |
|   |-- handlers/
|   |   |-- auth.go              # Register, login, JWT middleware
|   |   |-- master_auth.go       # Master token middleware (admin)
|   |   |-- document.go          # Document CRUD + sharing + save
|   |   |-- share_link.go        # Share link create/resolve/delete
|   |   +-- activity.go          # Activity logging and permission checks
|   |
|   |-- ws/
|   |   |-- hub.go               # WebSocket room manager (pub/sub)
|   |   +-- client.go            # WS client -- read/write pumps, message handling
|   |
|   +-- static/                  # Legacy vanilla HTML/JS/CSS frontend
|       |-- index.html
|       |-- editor.html
|       |-- css/style.css
|       +-- js/
|           |-- app.js
|           +-- editor.js
|
+-- frontend/                    # Modern Next.js frontend
    |-- package.json
    |-- next.config.ts            # API proxy rewrites to backend
    |-- tsconfig.json
    |-- next-env.d.ts
    |-- quill.d.ts                # Quill CSS type declarations
    |
    |-- app/
    |   |-- layout.tsx            # Root layout (metadata, body)
    |   |-- globals.css           # Full design system (light + dark)
    |   |-- page.tsx              # Dashboard -- doc list, create, delete
    |   |-- auth/
    |   |   +-- page.tsx          # Login / Register with password strength
    |   |-- editor/
    |   |   +-- [id]/
    |   |       +-- page.tsx      # Real-time collaborative Quill editor
    |   +-- shared/
    |       +-- [token]/
    |           +-- page.tsx      # Guest access via share link
    |
    |-- components/
    |   |-- ActiveUsers.tsx       # Colored avatar circles for live users
    |   |-- ActivityPanel.tsx     # Sidebar activity log with auto-refresh
    |   |-- DocumentCard.tsx      # Document card in dashboard grid
    |   |-- ShareModal.tsx        # Share via link or email (tabbed UI)
    |   |-- ThemeToggle.tsx       # Dark/light mode toggle
    |   |-- Toast.tsx             # Global toast notifications
    |   +-- UsernameModal.tsx     # Guest username entry modal
    |
    |-- lib/
    |   |-- api.ts                # REST API client functions
    |   +-- types.ts              # TypeScript interfaces
    |
    +-- public/
        +-- logo.png              # App logo
```

---

## Security Notes

- Passwords are hashed with **bcrypt** before storage
- Authentication uses **HS256 JWT** tokens with configurable expiry
- Admin endpoints are protected by a separate **Master Token**
- CORS is **permissive in development**, **restricted in production**
- WebSocket enforces **permission-based write protection** (view-only users cannot send deltas or save)
- Share link tokens are **32-byte cryptographically random hex strings**

---

<p align="center">
  Built with Go + Next.js + PostgreSQL
</p>
