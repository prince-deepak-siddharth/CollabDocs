package db

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/collabdocs/config"
	_ "github.com/lib/pq"
)

var DB *sql.DB

func Init() {
	dsn := config.AppConfig.DatabaseURL

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	fmt.Println("✅ Connected to PostgreSQL")
	createTables()
}

func createTables() {
	query := `
	CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username VARCHAR(255) UNIQUE NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS documents (
		id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
		title VARCHAR(500) NOT NULL DEFAULT 'Untitled Document',
		content JSONB DEFAULT '{"ops":[{"insert":"\\n"}]}',
		owner_name VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS collaborators (
		id SERIAL PRIMARY KEY,
		document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
		user_name VARCHAR(255) NOT NULL,
		permission VARCHAR(50) DEFAULT 'edit',
		added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(document_id, user_name)
	);

	CREATE TABLE IF NOT EXISTS share_links (
		id SERIAL PRIMARY KEY,
		document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
		token VARCHAR(64) UNIQUE NOT NULL,
		permission VARCHAR(20) NOT NULL DEFAULT 'view',
		created_by VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_name);
	CREATE INDEX IF NOT EXISTS idx_collaborators_user ON collaborators(user_name);
	CREATE INDEX IF NOT EXISTS idx_collaborators_doc ON collaborators(document_id);
	CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
	CREATE INDEX IF NOT EXISTS idx_share_links_doc ON share_links(document_id);
	CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

	CREATE TABLE IF NOT EXISTS activity_log (
		id SERIAL PRIMARY KEY,
		document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
		user_name VARCHAR(255) NOT NULL,
		action VARCHAR(50) NOT NULL,
		details TEXT DEFAULT '',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_activity_log_doc ON activity_log(document_id);
	CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
	`

	_, err := DB.Exec(query)
	if err != nil {
		log.Fatal("Failed to create tables:", err)
	}
	fmt.Println("✅ Database tables ready")
}
