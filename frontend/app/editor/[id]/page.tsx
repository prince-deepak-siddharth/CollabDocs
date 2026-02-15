'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getDocument, updateDocumentTitle, getWsUrl, getMe } from '@/lib/api';
import { ActiveUser, WsMessage } from '@/lib/types';
import ShareModal from '@/components/ShareModal';
import ActiveUsers from '@/components/ActiveUsers';
import ActivityPanel from '@/components/ActivityPanel';
import ThemeToggle from '@/components/ThemeToggle';
import Toast, { showToast } from '@/components/Toast';

export default function EditorPage() {
    const router = useRouter();
    const params = useParams();
    const docId = params.id as string;

    const [username, setUsername] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [saved, setSaved] = useState(true);
    const [showShare, setShowShare] = useState(false);
    const [showActivity, setShowActivity] = useState(false);
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [editorReady, setEditorReady] = useState(false);
    const [permission, setPermission] = useState<string>('view');
    const [ownerName, setOwnerName] = useState<string>('');

    const quillRef = useRef<any>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isRemoteChangeRef = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const canEdit = permission === 'owner' || permission === 'edit';
    const isOwner = permission === 'owner';

    // Check auth
    useEffect(() => {
        let active = true;
        async function checkAuth() {
            const token = localStorage.getItem('collabdocs_token');
            if (!token) {
                router.push('/auth');
                return;
            }
            try {
                const user = await getMe();
                if (active) setUsername(user.username);
            } catch {
                if (active) router.push('/auth');
            }
        }
        checkAuth();
        return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load Quill
    useEffect(() => {
        if (!username || !editorContainerRef.current) return;

        let mounted = true;

        async function initQuill() {
            const QuillModule = await import('quill');
            const Quill = QuillModule.default;
            await import('quill/dist/quill.snow.css');

            if (!mounted || !editorContainerRef.current) return;
            editorContainerRef.current.innerHTML = '';

            // Load document first to get permission level
            let doc;
            try {
                doc = await getDocument(docId);
                if (!mounted) return;
                setTitle(doc.title);
                setOwnerName(doc.owner_name);
                const docPerm = doc.permission || 'view';
                setPermission(docPerm);
            } catch (err: any) {
                if (!mounted) return;
                showToast(err.message || 'Access denied', 'error');
                router.push('/');
                return;
            }

            const userCanEdit = doc.permission === 'owner' || doc.permission === 'edit';

            // Only show toolbar for users who can edit
            const toolbarOptions = userCanEdit ? {
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
            editorContainerRef.current!.appendChild(editorDiv);

            const quill = new Quill(editorDiv, {
                theme: 'snow',
                modules: { toolbar: toolbarOptions },
                placeholder: userCanEdit ? 'Start writing something amazing...' : '',
                readOnly: !userCanEdit,
            });

            quillRef.current = quill;

            // Load content
            if (doc.content && doc.content.trim() && doc.content.trim() !== '\\\\n') {
                try {
                    const content = JSON.parse(doc.content);
                    quill.setContents(content, 'silent');
                } catch {
                    quill.setText(doc.content, 'silent');
                }
            }

            // Text change (only for editors)
            if (userCanEdit) {
                quill.on('text-change', (delta: any, _old: any, source: string) => {
                    if (source === 'user' && !isRemoteChangeRef.current) {
                        const ws = wsRef.current;
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'delta', data: delta }));
                        }
                        setSaved(false);
                        scheduleSave();
                    }
                });
            }

            // Cursor
            quill.on('selection-change', (range: any, _old: any, source: string) => {
                if (source === 'user' && range) {
                    const ws = wsRef.current;
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'cursor', data: range }));
                    }
                }
            });

            setEditorReady(true);
        }

        initQuill();
        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, docId]);

    // WebSocket
    useEffect(() => {
        if (!username || !editorReady) return;

        function connect() {
            const wsUrl = getWsUrl(docId, username!);
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
                setTimeout(() => connect(), 2000);
            };
        }

        connect();

        return () => {
            wsRef.current?.close();
        };
    }, [username, docId, editorReady]);

    const scheduleSave = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && quillRef.current) {
                const content = JSON.stringify(quillRef.current.getContents());
                ws.send(JSON.stringify({ type: 'save', data: content }));
                setSaved(true);
            }
        }, 1000);
    }, []);

    const handleTitleChange = useCallback(async (newTitle: string) => {
        setTitle(newTitle);
        try {
            await updateDocumentTitle(docId, newTitle);
        } catch { }
    }, [docId]);

    // Ctrl+S (only for editors)
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!canEdit) return;
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN && quillRef.current) {
                    const content = JSON.stringify(quillRef.current.getContents());
                    ws.send(JSON.stringify({ type: 'save', data: content }));
                    setSaved(true);
                    showToast('Saved!');
                }
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [canEdit]);

    const permLabel: Record<string, string> = {
        owner: 'Owner',
        view: 'View Only',
        edit: 'Can Edit',
        comment: 'Can Comment',
    };

    const permColor: Record<string, string> = {
        owner: 'var(--accent)',
        view: 'var(--text-muted)',
        edit: 'var(--accent)',
        comment: 'var(--text-secondary)',
    };

    if (!username) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loader-spinner" />
            </div>
        );
    }

    return (
        <div className="editor-page">
            <header className="editor-header">
                <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <a href="/" className="back-link" title="Back to Dashboard">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                    </a>
                    {canEdit ? (
                        <input
                            className="title-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={(e) => handleTitleChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                        />
                    ) : (
                        <span className="title-input" style={{ cursor: 'default', opacity: 0.85 }}>{title}</span>
                    )}
                    <span className="save-indicator" style={{ color: permColor[permission], border: `1px solid ${permColor[permission]}30` }}>
                        {canEdit ? (saved ? 'Saved' : 'Saving...') : permLabel[permission]}
                    </span>
                </div>
                <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ActiveUsers users={activeUsers} />
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => setShowActivity(!showActivity)}
                        title="Activity Log"
                        style={showActivity ? { background: 'var(--bg-secondary)', color: 'var(--accent)' } : {}}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                    </button>
                    <ThemeToggle />
                    {isOwner && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowShare(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                            Share
                        </button>
                    )}
                </div>
            </header>

            <div className="editor-body">
                <div className={`editor-wrapper ${showActivity ? 'with-activity' : ''}`}>
                    <div ref={editorContainerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }} />
                </div>
                <ActivityPanel docId={docId} isOpen={showActivity} onClose={() => setShowActivity(false)} />
            </div>

            {showShare && <ShareModal docId={docId} onClose={() => setShowShare(false)} />}
            <Toast />
        </div>
    );
}
