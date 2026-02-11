'use client';

import { useEffect, useState, useRef } from 'react';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error';
}

let toastId = 0;
let addToastFn: ((message: string, type: 'success' | 'error') => void) | null = null;

export function showToast(message: string, type: 'success' | 'error' = 'success') {
    addToastFn?.(message, type);
}

export default function Toast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        addToastFn = (message: string, type: 'success' | 'error') => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3500);
        };
        return () => { addToastFn = null; };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="toast-area">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type}`}>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
