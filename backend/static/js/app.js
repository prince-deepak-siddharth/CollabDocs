// ===== Dashboard App Logic =====

const API_BASE = '';

// Toast notification system
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 300ms ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Username management
function getUsername() {
    return localStorage.getItem('collabdocs_username');
}

function setUsername(name) {
    localStorage.setItem('collabdocs_username', name);
}

function initUsernameModal() {
    const modal = document.getElementById('username-modal');
    const input = document.getElementById('username-input');
    const submitBtn = document.getElementById('username-submit');

    const username = getUsername();
    if (username) {
        modal.classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-badge').textContent = username;
        loadDocuments();
        return;
    }

    function submitUsername() {
        const name = input.value.trim();
        if (!name) {
            input.style.borderColor = '#ff6b6b';
            input.focus();
            return;
        }
        setUsername(name);
        modal.classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-badge').textContent = name;
        loadDocuments();
    }

    submitBtn.addEventListener('click', submitUsername);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitUsername();
    });
    input.focus();
}

// Document operations
async function loadDocuments() {
    const username = getUsername();
    const grid = document.getElementById('documents-grid');
    const emptyState = document.getElementById('empty-state');

    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const res = await fetch(`${API_BASE}/api/documents?user=${encodeURIComponent(username)}`);
        const docs = await res.json();

        if (!docs || docs.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        grid.innerHTML = docs.map(doc => {
            const isOwner = doc.owner_name === username;
            const date = new Date(doc.updated_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const time = new Date(doc.updated_at).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });

            return `
                <div class="doc-card" data-id="${doc.id}" onclick="openDocument('${doc.id}')">
                    <div class="doc-card-title">${escapeHtml(doc.title)}</div>
                    <div class="doc-card-meta">
                        <div class="doc-card-owner">
                            <span>${date} · ${time}</span>
                        </div>
                        <div class="doc-card-actions">
                            ${isOwner ? `
                                <button class="btn btn-ghost" onclick="event.stopPropagation(); deleteDocument('${doc.id}')" title="Delete">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${!isOwner ? `<div class="shared-badge">📤 Shared by ${escapeHtml(doc.owner_name)}</div>` : ''}
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load documents:', err);
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">Failed to load documents. Is the server running?</p>';
    }
}

async function createDocument() {
    const username = getUsername();
    try {
        const res = await fetch(`${API_BASE}/api/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Untitled Document', owner_name: username })
        });

        if (!res.ok) throw new Error('Failed to create document');

        const doc = await res.json();
        showToast('Document created!');
        openDocument(doc.id);
    } catch (err) {
        console.error('Create failed:', err);
        showToast('Failed to create document', 'error');
    }
}

async function deleteDocument(id) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const res = await fetch(`${API_BASE}/api/documents/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');

        showToast('Document deleted');
        loadDocuments();
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete document', 'error');
    }
}

function openDocument(id) {
    window.location.href = `/editor.html?id=${id}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initUsernameModal();

    document.getElementById('new-doc-btn')?.addEventListener('click', createDocument);
    document.getElementById('empty-new-doc-btn')?.addEventListener('click', createDocument);

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('collabdocs_username');
        location.reload();
    });
});
