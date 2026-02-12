'use client';

import { Document } from '@/lib/types';

interface Props {
    doc: Document;
    currentUser: string;
    index: number;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function DocumentCard({ doc, currentUser, index, onOpen, onDelete }: Props) {
    const isOwner = doc.owner_name === currentUser;
    const date = new Date(doc.updated_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
        <div
            className="doc-card"
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={() => onOpen(doc.id)}
        >
            <div className="doc-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
            </div>
            <div className="doc-card-title">{doc.title}</div>
            <div className="doc-card-date">{dateStr} · {timeStr}</div>

            <div className="doc-card-footer">
                <div className="doc-card-owner">
                    <span className="avatar-mini">{doc.owner_name.charAt(0)}</span>
                    <span>{isOwner ? 'You' : doc.owner_name}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!isOwner && (
                        <span className="shared-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <polyline points="17 11 19 13 23 9" />
                            </svg>
                            Shared
                        </span>
                    )}

                    {isOwner && (
                        <button
                            className="btn btn-ghost doc-card-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(doc.id);
                            }}
                            title="Delete document"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
