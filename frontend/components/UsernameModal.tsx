'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
    onSubmit: (username: string) => void;
}

export default function UsernameModal({ onSubmit }: Props) {
    const [name, setName] = useState('');
    const [shake, setShake] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            inputRef.current?.focus();
            return;
        }
        onSubmit(trimmed);
    };

    return (
        <div className="modal-overlay">
            <div className="modal" style={shake ? { animation: 'shake 0.4s ease' } : {}}>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <img src="/logo.png" alt="CollabDocs" style={{
                        width: 72,
                        height: 72,
                        margin: '0 auto 20px',
                        borderRadius: 16,
                        boxShadow: 'var(--shadow-md)',
                        display: 'block',
                    }} />
                    <h2 style={{
                        fontSize: 24,
                        fontWeight: 800,
                        letterSpacing: -0.5,
                        marginBottom: 6,
                        color: 'var(--accent)',
                    }}>
                        Welcome to CollabDocs
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
                        Enter your name to start creating & collaborating
                    </p>
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    className="input"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    maxLength={30}
                    style={{ marginBottom: 16 }}
                />

                <button className="btn btn-primary btn-lg btn-full" onClick={handleSubmit}>
                    Get Started
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>

                <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }
        `}</style>
            </div>
        </div>
    );
}
