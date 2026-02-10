export interface Document {
    id: string;
    title: string;
    content: string;
    owner_name: string;
    created_at: string;
    updated_at: string;
    permission?: string;
}

export interface Collaborator {
    id: number;
    document_id: string;
    user_name: string;
    permission: string;
    added_at: string;
}

export interface ActiveUser {
    user_name: string;
    color: string;
}

export interface WsMessage {
    type: 'delta' | 'users' | 'cursor' | 'save';
    data: any;
    doc_id?: string;
}

export interface User {
    id: number;
    username: string;
    email: string;
    created_at: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface ShareLink {
    id: number;
    document_id: string;
    token: string;
    permission: string;
    created_by: string;
    created_at: string;
    url?: string;
}

export interface ShareLinkResponse {
    document_id: string;
    title: string;
    permission: string;
    owner_name: string;
}

export interface ActivityLog {
    id: number;
    document_id: string;
    user_name: string;
    action: string;
    details: string;
    created_at: string;
}
