'use client';

import { useState, useEffect } from 'react';
import { shareDocument, getCollaborators, createShareLink, getDocumentShareLinks, deleteShareLink } from '@/lib/api';
import { Collaborator, ShareLink } from '@/lib/types';
import { showToast } from './Toast';

interface Props {
    docId: string;
    onClose: () => void;
}

export default function ShareModal({ docId, onClose }: Props) {
    const [shareEmail, setShareEmail] = useState('');
    const [permission, setPermission] = useState('edit');
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
    const [linkPermission, setLinkPermission] = useState('view');
    const [tab, setTab] = useState<'users' | 'links'>('links');

    useEffect(() => {
        loadCollaborators();
        loadShareLinks();
    }, [docId]);

    async function loadCollaborators() {
        try {
            const data = await getCollaborators(docId);
            setCollaborators(data || []);
        } catch { }
    }

    async function loadShareLinks() {
        try {
            const data = await getDocumentShareLinks(docId);
            setShareLinks(data || []);
        } catch { }
    }

    async function handleShareUser() {
        const trimmed = shareEmail.trim();
        if (!trimmed) return;
        try {
            await shareDocument(docId, trimmed, permission);
            showToast(`Shared with ${trimmed}!`);
            setShareEmail('');
            loadCollaborators();
        } catch (e: any) {
            showToast(e.message || 'Failed to share', 'error');
        }
    }

    async function handleCreateLink() {
        try {
            const link = await createShareLink(docId, linkPermission);
            const url = `${window.location.origin}/shared/${link.token}`;
            await navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard!');
            loadShareLinks();
        } catch (e: any) {
            showToast(e.message || 'Failed to create link', 'error');
        }
    }

    async function handleDeleteLink(linkId: number) {
        try {
            await deleteShareLink(docId, linkId);
            showToast('Link deleted');
            loadShareLinks();
        } catch {
            showToast('Failed to delete link', 'error');
        }
    }

    function copyLink(token: string) {
        const url = `${window.location.origin}/shared/${token}`;
        navigator.clipboard.writeText(url);
        showToast('Link copied!');
    }

    const permColor: Record<string, string> = {
        view: 'var(--text-muted)',
        edit: 'var(--accent)',
        comment: 'var(--text-secondary)',
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '90%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Share Document</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon" title="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setTab('links')}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            background: tab === 'links' ? 'var(--accent)' : 'transparent',
                            color: tab === 'links' ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        Share Link
                    </button>
                    <button
                        onClick={() => setTab('users')}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            background: tab === 'users' ? 'var(--accent)' : 'transparent',
                            color: tab === 'users' ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        By Email
                    </button>
                </div>

                {tab === 'links' ? (
                    <>
                        {/* Create Link */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            <select
                                className="input"
                                value={linkPermission}
                                onChange={(e) => setLinkPermission(e.target.value)}
                                style={{ flex: '0 0 140px', cursor: 'pointer' }}
                            >
                                <option value="view">Can View</option>
                                <option value="edit">Can Edit</option>
                                <option value="comment">Can Comment</option>
                            </select>
                            <button className="btn btn-primary" onClick={handleCreateLink} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                Create &amp; Copy Link
                            </button>
                        </div>

                        {/* Existing Links */}
                        {shareLinks.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Active Links
                                </h4>
                                {shareLinks.map((link) => (
                                    <div key={link.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                    }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: permColor[link.permission] || 'var(--text-secondary)',
                                        }}>
                                            {link.permission}
                                        </span>
                                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            ...{link.token.slice(-12)}
                                        </span>
                                        <button
                                            onClick={() => copyLink(link.token)}
                                            className="btn btn-ghost btn-icon"
                                            title="Copy link"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLink(link.id)}
                                            className="btn btn-ghost btn-icon"
                                            style={{ color: 'var(--danger)' }}
                                            title="Delete link"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Share by Email */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <input
                                type="email"
                                className="input"
                                placeholder="Enter email address"
                                value={shareEmail}
                                onChange={(e) => setShareEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleShareUser()}
                                style={{ flex: 1 }}
                            />
                            <select
                                className="input"
                                value={permission}
                                onChange={(e) => setPermission(e.target.value)}
                                style={{ flex: '0 0 120px', cursor: 'pointer' }}
                            >
                                <option value="edit">Can Edit</option>
                                <option value="view">Can View</option>
                                <option value="comment">Comment</option>
                            </select>
                        </div>
                        <button className="btn btn-primary btn-full" onClick={handleShareUser} style={{ marginBottom: 20 }}>
                            Share
                        </button>

                        {/* Collaborator List */}
                        {collaborators.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Collaborators
                                </h4>
                                {collaborators.map((c) => (
                                    <div key={c.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                    }}>
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: 'var(--accent)',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}>
                                            {c.user_name.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ flex: 1, fontSize: 14 }}>{c.user_name}</span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: permColor[c.permission] || 'var(--text-secondary)',
                                        }}>
                                            {c.permission}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
