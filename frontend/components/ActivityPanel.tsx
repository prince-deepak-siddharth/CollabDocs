'use client';

import { useState, useEffect, useCallback } from 'react';
import { ActivityLog } from '@/lib/types';
import { getActivityLog } from '@/lib/api';

interface Props {
    docId: string;
    isOpen: boolean;
    onClose: () => void;
}

const actionLabels: Record<string, string> = {
    create: 'Created document',
    edit: 'Edited content',
    title_change: 'Changed title',
    share: 'Shared document',
    unshare: 'Removed access',
    comment: 'Left a comment',
};

function ActionIcon({ action }: { action: string }) {
    switch (action) {
        case 'create':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            );
        case 'edit':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
            );
        case 'title_change':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
                </svg>
            );
        case 'share':
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                </svg>
            );
        default:
            return (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            );
    }
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(logs: ActivityLog[]): [string, ActivityLog[]][] {
    const groups: Record<string, ActivityLog[]> = {};
    for (const log of logs) {
        const date = new Date(log.created_at).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
        });
        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
    }
    return Object.entries(groups);
}

export default function ActivityPanel({ docId, isOpen, onClose }: Props) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            const data = await getActivityLog(docId);
            setLogs(data || []);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, [docId]);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        fetchLogs();
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, [isOpen, fetchLogs]);

    if (!isOpen) return null;

    const grouped = groupByDate(logs);

    return (
        <div className="activity-panel">
            <div className="activity-panel-header">
                <h3>Activity</h3>
                <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="activity-panel-body">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <div className="loader-spinner" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="activity-empty">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <p>No activity yet</p>
                    </div>
                ) : (
                    grouped.map(([date, entries]) => (
                        <div key={date}>
                            <div className="activity-date-divider">{date}</div>
                            {entries.map((entry) => (
                                <div key={entry.id} className="activity-entry">
                                    <div className="activity-entry-icon">
                                        <ActionIcon action={entry.action} />
                                    </div>
                                    <div className="activity-entry-content">
                                        <div className="activity-entry-user">{entry.user_name}</div>
                                        <div className="activity-entry-details">
                                            {entry.details || actionLabels[entry.action] || entry.action}
                                        </div>
                                        <div className="activity-entry-time">{timeAgo(entry.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
