// nav.js - shared sidebar engine used by cashier-nav.js and admin-nav.js.
// Injects its own DOM/CSS (mirrors the pattern in ui.js) so pages only need
// to import a role-specific mount function - no matching HTML/CSS required.
// Does NOT touch admin.html or cashier.html, which keep their own distinct
// full-screen nav-overlay/nav-grid launcher menus.

import { logout } from './auth.js';
import { confirmModal } from './ui.js';

let stylesInjected = false;

function ensureNavStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .sidebar {
            width: 70px;
            height: 100vh;
            background: #0f172a;
            position: fixed;
            left: 0;
            top: 0;
            z-index: 3000;
            overflow-x: hidden;
            overflow-y: auto;
            transition: width 0.3s ease;
            padding: 20px 10px;
            display: flex;
            flex-direction: column;
            color: white;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .sidebar:hover, .sidebar.mobile-active { width: 260px; }
        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 0 10px;
            min-height: 40px;
        }
        .sidebar-header h2 {
            font-size: 1.2rem;
            margin: 0;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
            color: white;
            font-weight: 800;
        }
        .sidebar:hover .sidebar-header h2, .sidebar.mobile-active .sidebar-header h2 { opacity: 1; }
        .sidebar .close-btn {
            display: none;
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
        }
        .sidebar .branch-info {
            padding: 10px;
            margin: 10px 0 20px;
            background: rgba(79, 70, 229, 0.2);
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            white-space: nowrap;
        }
        .sidebar .branch-label {
            font-size: 0.6rem;
            text-transform: uppercase;
            color: #94a3b8;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .sidebar:hover .branch-label, .sidebar.mobile-active .branch-label { opacity: 1; }
        .sidebar .branch-name {
            font-weight: 800;
            color: white;
            font-size: 0.85rem;
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .sidebar .branch-name i { color: #4f46e5; min-width: 20px; }
        .sidebar .branch-name span { opacity: 0; transition: opacity 0.2s; }
        .sidebar:hover .branch-name span, .sidebar.mobile-active .branch-name span { opacity: 1; }
        .sidebar .nav-list { flex: 1; list-style: none; padding: 0; margin: 0; }
        .sidebar .nav-link {
            display: flex;
            align-items: center;
            padding: 12px;
            color: #94a3b8;
            text-decoration: none;
            border-radius: 8px;
            margin-bottom: 5px;
            transition: 0.3s;
            white-space: nowrap;
            font-weight: 600;
            cursor: pointer;
        }
        .sidebar .nav-link i { min-width: 30px; font-size: 1.2rem; text-align: center; margin-right: 15px; }
        .sidebar .nav-link span { opacity: 0; white-space: nowrap; transition: opacity 0.2s; }
        .sidebar:hover .nav-link span, .sidebar.mobile-active .nav-link span { opacity: 1; }
        .sidebar .nav-link:hover, .sidebar .nav-link.active { background: #4f46e5; color: white; }
        .sidebar .nav-link.switch-link { background: #0ea5e9; color: white; margin-bottom: 15px; }
        .sidebar .nav-divider { height: 1px; background: rgba(255,255,255,0.1); margin: 10px 0; }
        .sidebar .nav-logout-wrap { margin-top: auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
        .sidebar .nav-link.nav-logout { color: #fb7185; }
        .menu-trigger {
            display: none;
            position: fixed;
            top: 15px;
            left: 15px;
            z-index: 2500;
            background: #0f172a;
            color: white;
            border: none;
            padding: 12px 18px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 700;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 2999;
        }
        .overlay.active { display: block; }
        @media (max-width: 1024px) {
            .sidebar { transform: translateX(-100%); width: 260px; }
            .sidebar.mobile-active { transform: translateX(0); }
            .menu-trigger { display: block; }
            .sidebar .close-btn { display: block; }
        }
    `;
    document.head.appendChild(style);
}

function currentPageName() {
    return decodeURIComponent(location.pathname.split('/').pop()) || 'index.html';
}

function renderLink(item, current) {
    if (item.divider) return '<div class="nav-divider"></div>';
    const active = item.href === current ? ' active' : '';
    return `<a href="${item.href}" class="nav-link${active}"><i class="fas ${item.icon}"></i> <span>${item.label}</span></a>`;
}

export function mountSidebar({ brandLabel, links, showSwitchLink = false }) {
    ensureNavStyles();
    const current = currentPageName();

    const switchLinkHtml = showSwitchLink ? `
        <a href="#" onclick="confirmSwitchToCashier(event)" class="nav-link switch-link">
            <i class="fas fa-exchange-alt"></i> <span>SWITCH TO CASHIER</span>
        </a>` : '';

    document.body.insertAdjacentHTML('afterbegin', `
        <div class="overlay" id="overlay" onclick="toggleMenu()"></div>
        <button class="menu-trigger" onclick="toggleMenu()">☰ MENU</button>
        <div class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <h2>${brandLabel}</h2>
                <button class="close-btn" onclick="toggleMenu()">×</button>
            </div>
            <div class="branch-info" id="sidebarBranchInfo">
                <div class="branch-label">Your Assigned Branch</div>
                <div class="branch-name" id="sidebarBranchName">
                    <i class="fas fa-store"></i>
                    <span>Loading...</span>
                </div>
            </div>
            <nav class="nav-list">
                ${switchLinkHtml}
                ${links.map(item => renderLink(item, current)).join('')}
                <div class="nav-logout-wrap">
                    <a onclick="logoutUser()" class="nav-link nav-logout">
                        <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
                    </a>
                </div>
            </nav>
        </div>
    `);
}

window.toggleMenu = () => {
    document.getElementById('sidebar')?.classList.toggle('mobile-active');
    document.getElementById('overlay')?.classList.toggle('active');
};

window.logoutUser = async () => {
    const confirmed = await confirmModal({
        title: 'Logout',
        message: 'Are you sure you want to log out?',
        confirmText: 'Logout',
        danger: true
    });
    if (confirmed) await logout();
};
