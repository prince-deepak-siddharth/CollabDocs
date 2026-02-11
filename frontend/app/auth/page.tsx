'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { register, login } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import Toast, { showToast } from '@/components/Toast';

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
    if (!pw) return { level: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 1, label: 'Weak', color: '#f87171' };
    if (score === 2) return { level: 2, label: 'Fair', color: '#fbbf24' };
    if (score === 3) return { level: 3, label: 'Strong', color: '#34d399' };
    return { level: 4, label: 'Very Strong', color: '#22d3ee' };
}

function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isValidUsername(u: string) {
    return /^[a-zA-Z0-9_]{3,30}$/.test(u);
}

export default function AuthPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const token = localStorage.getItem('collabdocs_token');
        if (token) router.push('/');
        emailRef.current?.focus();
    }, [router]);

    const pwStrength = useMemo(() => getPasswordStrength(password), [password]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (mode === 'register') {
            if (!isValidUsername(username)) {
                showToast('Username: 3-30 chars, letters, numbers, underscores only', 'error');
                return;
            }
            if (!isValidEmail(email)) {
                showToast('Please enter a valid email address', 'error');
                return;
            }
            if (pwStrength.level < 2) {
                showToast('Password is too weak. Add uppercase, numbers, or symbols.', 'error');
                return;
            }
        }
        setLoading(true);
        try {
            if (mode === 'register') {
                const res = await register(username.trim(), email.trim(), password);
                localStorage.setItem('collabdocs_token', res.token);
                localStorage.setItem('collabdocs_username', res.user.username);
                showToast('Account created!');
            } else {
                const res = await login(email.trim(), password);
                localStorage.setItem('collabdocs_token', res.token);
                localStorage.setItem('collabdocs_username', res.user.username);
                showToast('Welcome back!');
            }
            router.push('/');
        } catch (err: any) {
            showToast(err.message || 'Something went wrong', 'error');
        } finally {
            setLoading(false);
        }
    }

    const hintStyle: React.CSSProperties = {
        fontSize: 11,
        marginTop: 4,
        marginBottom: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.2s',
    };

    return (
        <>
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
            }}>
                <div style={{ position: 'absolute', top: 20, right: 20 }}>
                    <ThemeToggle />
                </div>
                <div className="modal" style={{ animation: 'modalEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <img src="/logo.png" alt="CollabDocs" style={{
                            width: 72, height: 72,
                            margin: '0 auto 20px',
                            borderRadius: 16,
                            boxShadow: 'var(--shadow-md)',
                            display: 'block',
                        }} />
                        <h2 style={{
                            fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6,
                            color: 'var(--accent)',
                        }}>
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                            {mode === 'login'
                                ? 'Sign in to access your documents'
                                : 'Join CollabDocs to start collaborating'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {mode === 'register' && (
                            <div>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    maxLength={30}
                                    required
                                />
                                <div style={{
                                    ...hintStyle,
                                    color: username
                                        ? isValidUsername(username) ? 'var(--success)' : 'var(--danger)'
                                        : 'var(--text-muted)',
                                }}>
                                    {username && (isValidUsername(username) ? '✓' : '✗')}{' '}
                                    3-30 characters • letters, numbers, underscores
                                </div>
                            </div>
                        )}

                        <div>
                            <input
                                ref={emailRef}
                                type="email"
                                className="input"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            {mode === 'register' && (
                                <div style={{
                                    ...hintStyle,
                                    color: email
                                        ? isValidEmail(email) ? 'var(--success)' : 'var(--danger)'
                                        : 'var(--text-muted)',
                                }}>
                                    {email && (isValidEmail(email) ? '✓' : '✗')}{' '}
                                    e.g. name@example.com
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder={mode === 'register' ? 'Create a password' : 'Password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                    required
                                    style={{ paddingRight: 44 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center',
                                    }}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {mode === 'register' && password && (
                                <div style={{ marginTop: 6 }}>
                                    {/* Strength bar */}
                                    <div style={{
                                        display: 'flex', gap: 3, marginBottom: 4,
                                    }}>
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} style={{
                                                flex: 1, height: 4,
                                                borderRadius: 2,
                                                background: i <= pwStrength.level ? pwStrength.color : 'var(--border)',
                                                transition: 'all 0.3s ease',
                                            }} />
                                        ))}
                                    </div>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: pwStrength.color }}>
                                            {pwStrength.label}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            6+ chars • uppercase • number • symbol
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg btn-full"
                            disabled={loading}
                            style={{ marginTop: 12, opacity: loading ? 0.6 : 1 }}
                        >
                            {loading ? (
                                <div className="loader-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                            ) : (
                                <>
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {mode === 'login' ? (
                            <>
                                Don&apos;t have an account?{' '}
                                <button
                                    onClick={() => { setMode('register'); setUsername(''); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                                >Sign Up</button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button
                                    onClick={() => setMode('login')}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                                >Sign In</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Toast />
        </>
    );
}
