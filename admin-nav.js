// admin-nav.js - single source of truth for the admin-role sidebar.
// Add a new admin page by adding one entry to ADMIN_LINKS below - every page
// that calls mountAdminNav() picks it up automatically.
// admin.html itself is excluded - it keeps its own distinct full-screen
// nav-overlay/nav-grid launcher menu.

import { mountSidebar } from './nav.js';
import { confirmModal } from './ui.js';

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
}

window.confirmSwitchToCashier = async (e) => {
    e.preventDefault();
    const confirmed = await confirmModal({
        title: 'Switch to Cashier Mode',
        message: 'Switch to Cashier Mode?',
        confirmText: 'Switch'
    });
    if (confirmed) window.location.href = 'cashier.html';
};
