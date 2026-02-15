'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { resolveShareLink, getDocument, getWsUrl } from '@/lib/api';
import { ActiveUser, WsMessage } from '@/lib/types';
import ActiveUsers from '@/components/ActiveUsers';
import Toast, { showToast } from '@/components/Toast';

export default function SharedPage() {
    const router = useRouter();
    const params = useParams();
    const token = params.token as string;

    const [permission, setPermission] = useState<string>('view');
    const [title, setTitle] = useState('');
    const [docId, setDocId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [guestName, setGuestName] = useState('');
    const [nameSet, setNameSet] = useState(false);

    const quillRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isRemoteChangeRef = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Resolve the share token
    useEffect(() => {
        async function resolve() {
            try {
                const data = await resolveShareLink(token);
                setDocId(data.document_id);
                setTitle(data.title);
                setPermission(data.permission);
            } catch {
                setError('This share link is invalid or has expired.');
            } finally {
                setLoading(false);
            }
        }
        resolve();
    }, [token]);

    // Check for existing username
    useEffect(() => {
        const stored = localStorage.getItem('collabdocs_username');
        if (stored) {
            setGuestName(stored);
            setNameSet(true);
        }
    }, []);

    // Init editor once we have doc + name
    useEffect(() => {
        if (!docId || !nameSet || !editorContainerRef.current) return;

        let mounted = true;

        async function initQuill() {
            const QuillModule = await import('quill');
            const Quill = QuillModule.default;
            await import('quill/dist/quill.snow.css');

            if (!mounted || !editorContainerRef.current) return;
            editorContainerRef.current.innerHTML = '';

            // Only add toolbar for edit permission
            const toolbarOptions = permission === 'edit' ? {
                container: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ color: [] }, { background: [] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ align: [] }],
                    ['blockquote', 'code-block'],
                    ['link', 'image'],
                    ['clean'],
                ],
            } : false;

            const editorDiv = document.createElement('div');
            editorContainerRef.current.appendChild(editorDiv);

            const quill = new Quill(editorDiv, {
                theme: 'snow',
                modules: { toolbar: toolbarOptions },
                placeholder: permission === 'view' ? '' : 'Start writing...',
                readOnly: permission !== 'edit',
            });

            quillRef.current = quill;

            // Load content
            try {
                const doc = await getDocument(docId!, token);
                try {
                    const content = JSON.parse(doc.content);
                    quill.setContents(content, 'silent');
                } catch {
                    if (doc.content) quill.setText(doc.content, 'silent');
                }
            } catch {
                showToast('Failed to load document', 'error');
                return;
            }

            // Text change → broadcast + save (only for editors)
            if (permission === 'edit') {
                quill.on('text-change', (delta: any, _old: any, source: string) => {
                    if (source === 'user' && !isRemoteChangeRef.current) {
                        const ws = wsRef.current;
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'delta', data: delta }));
                        }
                        scheduleSave();
                    }
                });
            }

            // Selection → cursor
            quill.on('selection-change', (range: any, _old: any, source: string) => {
                if (source === 'user' && range) {
                    const ws = wsRef.current;
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'cursor', data: range }));
                    }
                }
            });

            // Connect WebSocket
            connectWs();
        }

        function connectWs() {
            const wsUrl = getWsUrl(docId!, guestName);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const msg: WsMessage = JSON.parse(event.data);
                    if (msg.type === 'delta' && quillRef.current) {
                        isRemoteChangeRef.current = true;
                        const sel = quillRef.current.getSelection();
                        quillRef.current.updateContents(msg.data, 'silent');
                        if (sel) quillRef.current.setSelection(sel.index, sel.length, 'silent');
                        isRemoteChangeRef.current = false;
                    } else if (msg.type === 'users') {
                        setActiveUsers(msg.data || []);
                    }
                } catch { }
            };

            ws.onclose = () => {
                setTimeout(() => connectWs(), 2000);
            };
        }

        initQuill();

        return () => {
            mounted = false;
            wsRef.current?.close();
        };
    }, [docId, nameSet, permission, guestName]);

    const scheduleSave = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && quillRef.current) {
                const content = JSON.stringify(quillRef.current.getContents());
                ws.send(JSON.stringify({ type: 'save', data: content }));
            }
        }, 1000);
    }, []);

    const permLabel: Record<string, string> = {
        view: 'View Only',
        edit: 'Can Edit',
        comment: 'Can Comment',
    };

    const permColor: Record<string, string> = {
        view: 'var(--text-muted)',
        edit: 'var(--accent)',
        comment: 'var(--text-secondary)',
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative', zIndex: 1 }}>
                <div className="loader-spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, position: 'relative', zIndex: 1 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>{error}</h2>
                <button className="btn btn-primary" onClick={() => router.push('/auth')}>
                    Go to Login
                </button>
            </div>
        );
    }

    if (!nameSet) {
        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', position: 'relative', zIndex: 1 }}>
                    <div className="modal">
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <img src="/logo.png" alt="CollabDocs" style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 12, display: 'block' }} />
                            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                                You&apos;ve been invited!
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                <strong>{title}</strong> — <span style={{ color: permColor[permission] }}>{permLabel[permission]}</span>
                            </p>
                        </div>
                        <input
                            className="input"
                            placeholder="Enter your name to continue"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && guestName.trim()) {
                                    localStorage.setItem('collabdocs_username', guestName.trim());
                                    setNameSet(true);
                                }
                            }}
                            style={{ marginBottom: 12 }}
                        />
                        <button
                            className="btn btn-primary btn-full"
                            disabled={!guestName.trim()}
                            onClick={() => {
                                localStorage.setItem('collabdocs_username', guestName.trim());
                                setNameSet(true);
                            }}
                        >
                            Open Document
                        </button>
                    </div>
                </div>
                <Toast />
            </>
        );
    }

    return (
        <div className="editor-page">
            <header className="editor-header">
                <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <a href="/" className="back-link" title="Home">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                    </a>
                    <span className="title-input" style={{ cursor: 'default', opacity: 0.85 }}>{title}</span>
                    <span className="save-indicator" style={{ color: permColor[permission], border: `1px solid ${permColor[permission]}30` }}>
                        {permLabel[permission]}
                    </span>
                </div>
                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <ActiveUsers users={activeUsers} />
                </div>
            </header>

            <div className="editor-body">
                <div className="editor-wrapper">
                    <div ref={editorContainerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }} />
                </div>
            </div>
            <Toast />
        </div>
    );
}
