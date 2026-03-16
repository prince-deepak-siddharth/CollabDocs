import { Document, Collaborator, AuthResponse, ShareLink, ShareLinkResponse, ActivityLog } from './types';

const API_BASE = '';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function normalizeWsBaseUrl(url: string): string {
    if (!url) return '';

    const trimmed = trimTrailingSlash(url.trim());

    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
        return trimmed;
    }

    if (trimmed.startsWith('http://')) {
        return `ws://${trimmed.slice('http://'.length)}`;
    }

    if (trimmed.startsWith('https://')) {
        return `wss://${trimmed.slice('https://'.length)}`;
    }

    if (trimmed.includes('://')) {
        return trimmed;
    }

    const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production';
    return `${isProd ? 'wss' : 'ws'}://${trimmed}`;
}

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('collabdocs_token');
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// ---- Auth ----
export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Registration failed');
    }
    return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
    }
    return res.json();
}

export async function getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
}

// ---- Documents ----
export async function createDocument(title: string): Promise<Document> {
    const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Failed to create document');
    return res.json();
}

export async function getDocuments(): Promise<Document[]> {
    const res = await fetch(`${API_BASE}/api/documents`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
}

export async function getDocument(id: string, shareToken?: string): Promise<Document> {
    const url = shareToken
        ? `${API_BASE}/api/documents/${id}?token=${shareToken}`
        : `${API_BASE}/api/documents/${id}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Access denied' }));
        throw new Error(err.error || 'Failed to fetch document');
    }
    return res.json();
}

export async function updateDocumentTitle(id: string, title: string): Promise<Document> {
    const res = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Failed to update document');
    return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete document');
}

export async function shareDocument(id: string, email: string, permission = 'edit'): Promise<Collaborator> {
    const res = await fetch(`${API_BASE}/api/documents/${id}/share`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email, permission }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to share document');
    }
    return res.json();
}

export async function getCollaborators(id: string): Promise<Collaborator[]> {
    const res = await fetch(`${API_BASE}/api/documents/${id}/collaborators`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch collaborators');
    return res.json();
}

// ---- Share Links ----
export async function createShareLink(docId: string, permission: string): Promise<ShareLink> {
    const res = await fetch(`${API_BASE}/api/documents/${docId}/share-links`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ permission }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create share link');
    }
    return res.json();
}

export async function getDocumentShareLinks(docId: string): Promise<ShareLink[]> {
    const res = await fetch(`${API_BASE}/api/documents/${docId}/share-links`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch share links');
    return res.json();
}

export async function deleteShareLink(docId: string, linkId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/documents/${docId}/share-links/${linkId}`, {
        method: 'DELETE',
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete share link');
}

export async function resolveShareLink(token: string): Promise<ShareLinkResponse> {
    const res = await fetch(`${API_BASE}/api/share-links/${token}`);
    if (!res.ok) throw new Error('Invalid share link');
    return res.json();
}

export function getWsUrl(docId: string, userName: string): string {
    const configuredWsBase = normalizeWsBaseUrl(
        process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || ''
    );

    if (configuredWsBase) {
        const wsEndpoint = configuredWsBase.endsWith('/ws') ? configuredWsBase : `${configuredWsBase}/ws`;
        return `${wsEndpoint}?doc_id=${docId}&user_name=${encodeURIComponent(userName)}`;
    }

    const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'production';
    const protocol = isProd ? 'wss:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const host = window.location.host;
    return `${protocol}//${host}/ws?doc_id=${docId}&user_name=${encodeURIComponent(userName)}`;
}

// ---- Activity Log ----
export async function getActivityLog(docId: string): Promise<ActivityLog[]> {
    const res = await fetch(`${API_BASE}/api/documents/${docId}/activity`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch activity log');
    return res.json();
}
