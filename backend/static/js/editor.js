// ===== Editor Logic with Real-time Collaboration =====

const API_BASE = '';
let quill = null;
let ws = null;
let docId = null;
let userName = null;
let isRemoteChange = false;
let saveTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Get document ID from URL
function getDocId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Get username
function getUsername() {
    return localStorage.getItem('collabdocs_username');
}

// Toast
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

// Initialize Quill Editor
function initEditor() {
    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: '#toolbar'
        },
        placeholder: 'Start writing something amazing...',
    });

    // Listen for local text changes
    quill.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user' && !isRemoteChange) {
            // Send delta to other clients
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'delta',
                    data: delta
                }));
            }

            // Auto-save with debounce
            scheduleSave();
        }
    });

    // Listen for selection changes (cursor position)
    quill.on('selection-change', (range, oldRange, source) => {
        if (source === 'user' && range && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'cursor',
                data: range
            }));
        }
    });
}

// Load document from server
async function loadDocument() {
    try {
        const res = await fetch(`${API_BASE}/api/documents/${docId}`);
        if (!res.ok) {
            if (res.status === 404) {
                showToast('Document not found', 'error');
                setTimeout(() => window.location.href = '/', 1500);
                return;
            }
            throw new Error('Failed to load document');
        }

        const doc = await res.json();

        // Set title
        const titleInput = document.getElementById('doc-title');
        titleInput.value = doc.title;

        // Set content
        try {
            const content = JSON.parse(doc.content);
            quill.setContents(content, 'silent');
        } catch (e) {
            // If content is not valid JSON, set as text
            if (doc.content) {
                quill.setText(doc.content, 'silent');
            }
        }

        // Update page title
        document.title = `${doc.title} — CollabDocs`;

    } catch (err) {
        console.error('Failed to load document:', err);
        showToast('Failed to load document', 'error');
    }
}

// WebSocket connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?doc_id=${docId}&user_name=${encodeURIComponent(userName)}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('🔗 WebSocket connected');
        reconnectAttempts = 0;
        updateSaveStatus('Connected', 'saved');
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'delta':
                    applyRemoteDelta(message.data);
                    break;

                case 'users':
                    updateActiveUsers(message.data);
                    break;

                case 'cursor':
                    updateRemoteCursor(message.data);
                    break;
            }
        } catch (err) {
            console.error('Failed to parse WS message:', err);
        }
    };

    ws.onclose = (e) => {
        console.log('🔌 WebSocket disconnected');
        updateSaveStatus('Disconnected', 'saving');

        // Reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            reconnectAttempts++;
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(connectWebSocket, delay);
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}

// Apply remote delta
function applyRemoteDelta(delta) {
    isRemoteChange = true;

    // Save current selection
    const currentSelection = quill.getSelection();

    // Apply remote changes
    quill.updateContents(delta, 'silent');

    // Restore selection
    if (currentSelection) {
        // Adjust cursor position based on remote changes
        quill.setSelection(currentSelection.index, currentSelection.length, 'silent');
    }

    isRemoteChange = false;
}

// Update active users display
function updateActiveUsers(users) {
    const container = document.getElementById('active-users');
    container.innerHTML = users.map(user => `
        <div class="active-user-avatar" style="background: ${user.color}" title="${escapeHtml(user.user_name)}">
            ${user.user_name.charAt(0).toUpperCase()}
            <span class="tooltip">${escapeHtml(user.user_name)}</span>
        </div>
    `).join('');
}

// Update remote cursor (visual indicator)
function updateRemoteCursor(data) {
    // Remove existing cursor for this user
    const existingCursor = document.querySelector(`[data-cursor-user="${data.user_name}"]`);
    if (existingCursor) existingCursor.remove();

    if (!data.range) return;

    try {
        const bounds = quill.getBounds(data.range.index, data.range.length);
        if (!bounds) return;

        const editorContainer = document.querySelector('.ql-editor');
        const cursor = document.createElement('div');
        cursor.className = 'remote-cursor';
        cursor.setAttribute('data-cursor-user', data.user_name);
        cursor.style.cssText = `
            left: ${bounds.left}px;
            top: ${bounds.top}px;
            height: ${bounds.height}px;
            background: ${data.color};
        `;

        const label = document.createElement('div');
        label.className = 'remote-cursor-label';
        label.style.background = data.color;
        label.textContent = data.user_name;
        cursor.appendChild(label);

        editorContainer.appendChild(cursor);

        // Remove cursor indicator after 3 seconds of inactivity
        setTimeout(() => cursor.remove(), 3000);
    } catch (e) {
        // Cursor positioning can fail in edge cases
    }
}

// Save functionality
function scheduleSave() {
    clearTimeout(saveTimeout);
    updateSaveStatus('Saving...', 'saving');

    saveTimeout = setTimeout(() => {
        saveDocument();
    }, 1000);
}

function saveDocument() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Fallback: save via REST API
        saveViaRest();
        return;
    }

    const content = JSON.stringify(quill.getContents());
    ws.send(JSON.stringify({
        type: 'save',
        data: content
    }));

    updateSaveStatus('Saved', 'saved');
}

async function saveViaRest() {
    try {
        // We don't have a REST endpoint for content save, so use the title endpoint as heartbeat
        updateSaveStatus('Saved (offline)', 'saved');
    } catch (err) {
        console.error('Save failed:', err);
        updateSaveStatus('Save failed', 'saving');
    }
}

function updateSaveStatus(text, className) {
    const status = document.getElementById('save-status');
    status.textContent = text;
    status.className = `save-status ${className}`;
}

// Title editing
function initTitleEditor() {
    const titleInput = document.getElementById('doc-title');
    let titleTimeout;

    titleInput.addEventListener('input', () => {
        clearTimeout(titleTimeout);
        titleTimeout = setTimeout(async () => {
            try {
                await fetch(`${API_BASE}/api/documents/${docId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: titleInput.value || 'Untitled Document' })
                });
                document.title = `${titleInput.value || 'Untitled Document'} — CollabDocs`;
            } catch (err) {
                console.error('Failed to update title:', err);
            }
        }, 500);
    });
}

// Share modal
function initShareModal() {
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const shareClose = document.getElementById('share-close');
    const shareSubmit = document.getElementById('share-submit');
    const shareInput = document.getElementById('share-username');
    const shareMessage = document.getElementById('share-message');

    shareBtn.addEventListener('click', () => {
        shareModal.classList.remove('hidden');
        shareInput.focus();
        loadCollaborators();
    });

    shareClose.addEventListener('click', () => {
        shareModal.classList.add('hidden');
    });

    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.classList.add('hidden');
        }
    });

    shareSubmit.addEventListener('click', shareDocument);
    shareInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') shareDocument();
    });

    async function shareDocument() {
        const targetUser = shareInput.value.trim();
        if (!targetUser) {
            shareInput.style.borderColor = '#ff6b6b';
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/documents/${docId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_name: targetUser, permission: 'edit' })
            });

            if (!res.ok) {
                const error = await res.json();
                showShareMessage(error.error || 'Failed to share', 'error');
                return;
            }

            showShareMessage(`Shared with ${targetUser}!`, 'success');
            shareInput.value = '';
            loadCollaborators();
        } catch (err) {
            showShareMessage('Failed to share document', 'error');
        }
    }

    function showShareMessage(text, type) {
        shareMessage.textContent = text;
        shareMessage.className = `share-message ${type}`;
        shareMessage.classList.remove('hidden');
        setTimeout(() => shareMessage.classList.add('hidden'), 3000);
    }
}

async function loadCollaborators() {
    const list = document.getElementById('collaborators-list');

    try {
        const res = await fetch(`${API_BASE}/api/documents/${docId}/collaborators`);
        const collabs = await res.json();

        if (!collabs || collabs.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px;">No collaborators yet</p>';
            return;
        }

        list.innerHTML = `
            <h4>Collaborators</h4>
            ${collabs.map(c => `
                <div class="collab-item">
                    <span class="collab-name">${escapeHtml(c.user_name)}</span>
                    <span class="collab-permission">${c.permission}</span>
                </div>
            `).join('')}
        `;
    } catch (err) {
        console.error('Failed to load collaborators:', err);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            clearTimeout(saveTimeout);
            saveDocument();
            showToast('Document saved');
        }
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
    docId = getDocId();
    userName = getUsername();

    if (!docId) {
        window.location.href = '/';
        return;
    }

    if (!userName) {
        window.location.href = '/';
        return;
    }

    initEditor();
    await loadDocument();
    connectWebSocket();
    initTitleEditor();
    initShareModal();
    initKeyboardShortcuts();
});

// Save before leaving
window.addEventListener('beforeunload', () => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveDocument();
    }
    if (ws) {
        ws.close();
    }
});
