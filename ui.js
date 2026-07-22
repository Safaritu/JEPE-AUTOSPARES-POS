// ui.js - shared toast notifications and promise-based confirm/prompt modals.
// Injects its own DOM/CSS into the page on first use, so any file can
// import these without needing matching HTML/CSS already authored there.

let stylesInjected = false;
let toastContainer = null;
let modalOverlay = null;

function ensureStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .ui-toast-container {
            position: fixed;
            bottom: 25px;
            right: 25px;
            left: 25px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            pointer-events: none;
        }
        .ui-toast {
            background: #0f172a;
            color: white;
            padding: 14px 20px;
            border-radius: 12px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 0.85rem;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            border-left: 4px solid #818cf8;
            max-width: 360px;
            pointer-events: auto;
            animation: uiToastIn 0.3s ease forwards;
        }
        .ui-toast.removing { animation: uiToastOut 0.3s ease forwards; }
        .ui-toast.success { border-left-color: #10b981; }
        .ui-toast.error { border-left-color: #ef4444; }
        .ui-toast.warning { border-left-color: #f59e0b; }
        .ui-toast.info { border-left-color: #818cf8; }
        @keyframes uiToastIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes uiToastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-10px); } }

        .ui-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            padding: 20px;
        }
        .ui-modal-overlay.active { display: flex; }
        .ui-modal {
            background: white;
            border-radius: 20px;
            padding: 25px;
            width: 100%;
            max-width: 380px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
        }
        .ui-modal h3 {
            font-size: 1.05rem;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 8px;
        }
        .ui-modal p {
            font-size: 0.85rem;
            color: #64748b;
            margin: 0 0 15px;
            line-height: 1.5;
        }
        .ui-modal label {
            display: block;
            font-size: 0.75rem;
            font-weight: 700;
            color: #64748b;
            margin-bottom: 6px;
        }
        .ui-modal input {
            width: 100%;
            padding: 12px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            font-size: 0.9rem;
            margin-bottom: 15px;
            outline: none;
            box-sizing: border-box;
            font-family: inherit;
        }
        .ui-modal input:focus { border-color: #4f46e5; }
        .ui-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .ui-modal-actions button {
            padding: 10px 18px;
            border-radius: 30px;
            border: none;
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
            font-family: inherit;
        }
        .ui-btn-cancel { background: #f1f5f9; color: #1e293b; }
        .ui-btn-confirm { background: #4f46e5; color: white; }
        .ui-btn-confirm.danger { background: #ef4444; }
    `;
    document.head.appendChild(style);
}

function ensureToastContainer() {
    ensureStyles();
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'ui-toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
}

export function showToast(message, type = 'info', duration = 5000) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `ui-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function ensureModalOverlay() {
    ensureStyles();
    if (modalOverlay && document.body.contains(modalOverlay)) return modalOverlay;
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'ui-modal-overlay';
    document.body.appendChild(modalOverlay);
    return modalOverlay;
}

export function confirmModal({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
        const overlay = ensureModalOverlay();
        overlay.innerHTML = `
            <div class="ui-modal">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="ui-modal-actions">
                    <button class="ui-btn-cancel" type="button">${cancelText}</button>
                    <button class="ui-btn-confirm${danger ? ' danger' : ''}" type="button">${confirmText}</button>
                </div>
            </div>
        `;

        function close(result) {
            overlay.classList.remove('active');
            overlay.removeEventListener('click', onBackdropClick);
            resolve(result);
        }

        function onBackdropClick(e) {
            if (e.target === overlay) close(false);
        }

        overlay.querySelector('.ui-btn-cancel').addEventListener('click', () => close(false));
        overlay.querySelector('.ui-btn-confirm').addEventListener('click', () => close(true));
        overlay.addEventListener('click', onBackdropClick);

        overlay.classList.add('active');
    });
}

export function promptModal({ title = 'Enter value', label = '', placeholder = '', required = false } = {}) {
    return new Promise((resolve) => {
        const overlay = ensureModalOverlay();
        overlay.innerHTML = `
            <div class="ui-modal">
                <h3>${title}</h3>
                ${label ? `<label>${label}</label>` : ''}
                <input type="text" id="ui-prompt-input" placeholder="${placeholder}">
                <div class="ui-modal-actions">
                    <button class="ui-btn-cancel" type="button">Cancel</button>
                    <button class="ui-btn-confirm" type="button">OK</button>
                </div>
            </div>
        `;

        const input = overlay.querySelector('#ui-prompt-input');

        function close(result) {
            overlay.classList.remove('active');
            overlay.removeEventListener('click', onBackdropClick);
            resolve(result);
        }

        function onBackdropClick(e) {
            if (e.target === overlay) close(null);
        }

        function attemptConfirm() {
            const value = input.value.trim();
            if (required && !value) {
                input.style.borderColor = '#ef4444';
                input.focus();
                return;
            }
            close(value);
        }

        overlay.querySelector('.ui-btn-cancel').addEventListener('click', () => close(null));
        overlay.querySelector('.ui-btn-confirm').addEventListener('click', attemptConfirm);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptConfirm(); });
        overlay.addEventListener('click', onBackdropClick);

        overlay.classList.add('active');
        setTimeout(() => input.focus(), 50);
    });
}
