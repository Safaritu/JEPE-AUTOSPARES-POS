// admin-nav.js - single source of truth for the admin-role sidebar.
// Add a new admin page by adding one entry to ADMIN_LINKS below - every page
// that calls mountAdminNav() picks it up automatically.
// admin.html itself is excluded - it keeps its own distinct full-screen
// nav-overlay/nav-grid launcher menu.

import { mountSidebar } from './nav.js';
import { supabase } from './auth.js';
import { showToast } from './ui.js';

const ADMIN_LINKS = [
    { href: 'admin.html', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { href: 'gas_hub.html', icon: 'fa-fire', label: 'Gas Hub' },
    { href: 'spares_hub.html', icon: 'fa-cogs', label: 'Spare Parts Hub' },
    { href: 'motorbike_hub.html', icon: 'fa-motorcycle', label: 'Motorbike Hub' },
    { href: 'tuktukhub.html', icon: 'fa-car-side', label: 'TUKTUK Hub' },
    { divider: true },
    { href: 'shift-history.html', icon: 'fa-history', label: 'Daily Shifts' },
    { href: 'money-history.html', icon: 'fa-money-bill-wave', label: 'Money IN/OUT' },
    { href: 'sales-history.html', icon: 'fa-chart-line', label: 'Sales History' },
    { divider: true },
    { href: 'inventory.html', icon: 'fa-plus-circle', label: 'Add Stock' },
    { href: 'sales_editor.html', icon: 'fa-edit', label: 'Edit Stock' },
    { href: 'admin-debtors.html', icon: 'fa-users', label: 'Debtors' },
    { href: 'low_stock.html', icon: 'fa-exclamation-triangle', label: 'Low Stock' },
    { href: 'audit_trail.html', icon: 'fa-search', label: 'Inventory Track' },
    { divider: true },
    { href: 'reports.html', icon: 'fa-file-alt', label: 'Reports' },
    { href: 'price_audits.html', icon: 'fa-tags', label: 'Underpriced' },
    { href: 'suppliers.html', icon: 'fa-handshake', label: 'Suppliers' },
    { href: 'admin_expenses.html', icon: 'fa-credit-card', label: 'Paybill Manager' },
    { href: 'products_manager.html', icon: 'fa-box', label: 'Product Manager' },
    { href: 'user_approvals.html', icon: 'fa-user-check', label: 'User Approvals' },
    { href: 'Monthly Performance Report.html', icon: 'fa-chart-pie', label: 'Monthly Insights' },
    { divider: true },
    { href: 'admin.html', icon: 'fa-home', label: 'HOME' }
];

export function mountAdminNav() {
    mountSidebar({ brandLabel: 'JEPE ADMIN', links: ADMIN_LINKS, showSwitchLink: true });
    // Admins aren't tied to one branch - the sidebar's "Your Assigned Branch"
    // widget should say so, not show whatever branch_id happens to sit on
    // their own profile row. Pages must not overwrite this afterwards.
    const branchNameEl = document.querySelector('#sidebarBranchName span');
    if (branchNameEl) branchNameEl.textContent = 'All Branches';
}

let branchPickerStylesInjected = false;
function ensureBranchPickerStyles() {
    if (branchPickerStylesInjected) return;
    branchPickerStylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
        .nav-branch-overlay {
            position: fixed; inset: 0; background: rgba(15,23,42,0.6);
            backdrop-filter: blur(4px); display: flex; align-items: center;
            justify-content: center; z-index: 100000; padding: 20px;
        }
        .nav-branch-modal {
            background: white; border-radius: 20px; padding: 25px; width: 100%;
            max-width: 360px; font-family: 'Plus Jakarta Sans', sans-serif;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
        }
        .nav-branch-modal h3 { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 8px; }
        .nav-branch-modal p { font-size: 0.85rem; color: #64748b; margin: 0 0 15px; }
        .nav-branch-option {
            display: block; width: 100%; text-align: left; padding: 12px 16px;
            margin-bottom: 8px; border-radius: 12px; border: 1px solid #e2e8f0;
            background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.9rem;
            color: #1e293b; font-family: inherit;
        }
        .nav-branch-option:hover { background: #eef2ff; border-color: #4f46e5; }
        .nav-branch-cancel {
            width: 100%; margin-top: 5px; padding: 10px; border-radius: 30px;
            border: none; background: #f1f5f9; color: #1e293b; font-weight: 700;
            cursor: pointer; font-family: inherit;
        }
    `;
    document.head.appendChild(style);
}

function pickBranch(branches) {
    return new Promise((resolve) => {
        ensureBranchPickerStyles();
        const overlay = document.createElement('div');
        overlay.className = 'nav-branch-overlay';
        overlay.innerHTML = `
            <div class="nav-branch-modal">
                <h3>Switch to Cashier Mode</h3>
                <p>Select the branch to operate as cashier for:</p>
                ${branches.map(b => `<button type="button" class="nav-branch-option" data-id="${b.id}">🏪 ${b.name}</button>`).join('')}
                <button type="button" class="nav-branch-cancel">Cancel</button>
            </div>
        `;
        document.body.appendChild(overlay);

        function close(result) {
            overlay.remove();
            resolve(result);
        }

        overlay.querySelectorAll('.nav-branch-option').forEach(btn => {
            btn.addEventListener('click', () => close(btn.dataset.id));
        });
        overlay.querySelector('.nav-branch-cancel').addEventListener('click', () => close(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    });
}

window.confirmSwitchToCashier = async (e) => {
    e.preventDefault();
    const { data: branches, error } = await supabase.from('branches').select('*').order('name');
    if (error || !branches || branches.length === 0) {
        showToast('Could not load branches', 'error');
        return;
    }
    const branchId = await pickBranch(branches);
    if (branchId) {
        window.location.href = `cashier.html?branch=${branchId}`;
    }
};
