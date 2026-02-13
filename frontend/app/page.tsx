'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createDocument, getDocuments, deleteDocument, getMe } from '@/lib/api';
import { Document } from '@/lib/types';
import DocumentCard from '@/components/DocumentCard';
import ThemeToggle from '@/components/ThemeToggle';
import Toast, { showToast } from '@/components/Toast';

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('collabdocs_token');
      if (!token) {
        router.push('/auth');
        return;
      }
      try {
        const user = await getMe();
        setUsername(user.username);
        localStorage.setItem('collabdocs_username', user.username);
      } catch {
        localStorage.removeItem('collabdocs_token');
        localStorage.removeItem('collabdocs_username');
        router.push('/auth');
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (username) {
      loadDocs();
    }
  }, [username]);

  async function loadDocs() {
    setLoading(true);
    try {
      const data = await getDocuments();
      setDocs(data || []);
    } catch {
      showToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const doc = await createDocument('Untitled Document');
      showToast('Document created!');
      router.push(`/editor/${doc.id}`);
    } catch {
      showToast('Failed to create document', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteDocument(id);
      showToast('Document deleted');
      loadDocs();
    } catch {
      showToast('Failed to delete', 'error');
    }
  }

  function handleLogout() {
    localStorage.removeItem('collabdocs_token');
    localStorage.removeItem('collabdocs_username');
    router.push('/auth');
  }

  if (!username) {
    return (
      <div className="loader" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <img src="/logo.png" alt="CollabDocs" className="logo-img" />
            <span className="logo-text">CollabDocs</span>
          </div>
        </div>
        <div className="header-right">
          <ThemeToggle />
          <div className="user-pill">
            <span className="dot" />
            {username}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="dashboard">
        <div className="dashboard-hero">
          <h1>
            Your <span>Documents</span>
          </h1>
          <p>Create, edit, and collaborate in real-time</p>
        </div>

        <div className="dashboard-actions">
          <h2>Recent</h2>
          <button className="btn btn-primary" onClick={handleCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Document
          </button>
        </div>

        {loading ? (
          <div className="loader">
            <div className="loader-spinner" />
          </div>
        ) : docs.length > 0 ? (
          <div className="doc-grid">
            {docs.map((doc, i) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                currentUser={username!}
                index={i}
                onOpen={(id) => router.push(`/editor/${id}`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-orb">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3>No documents yet</h3>
            <p>Create your first document and start collaborating with friends</p>
            <button className="btn btn-primary btn-lg" onClick={handleCreate}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Document
            </button>
          </div>
        )}
      </main>

      <Toast />
    </>
  );
}
