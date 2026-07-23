// cashier-nav.js - single source of truth for the cashier-role sidebar.
// Add a new cashier page by adding one entry to CASHIER_LINKS below - every
// page that calls mountCashierNav() picks it up automatically.
// cashier.html itself is excluded - it keeps its own distinct full-screen
// nav-overlay/nav-grid launcher menu.

import { mountSidebar } from './nav.js';

const CASHIER_LINKS = [
    { href: 'cashier.html', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { href: 'cashiergashub.html', icon: 'fa-fire', label: 'Gas Hub' },
    { href: 'moneyinout.html', icon: 'fa-money-bill-wave', label: 'Money IN/OUT' },
    { href: 'shift history cashier.html', icon: 'fa-history', label: 'Shift History' },
    { href: 'sales_reports.html', icon: 'fa-chart-line', label: 'Sales History' },
    { href: 'cashier_inventory.html', icon: 'fa-plus-circle', label: 'Add Stock' },
    { href: 'sale edit cashier.html', icon: 'fa-edit', label: 'Edit Sales' },
    { divider: true },
    { href: 'low-stock-cashier.html', icon: 'fa-exclamation-triangle', label: 'Low Stock' },
    { href: 'debtors.html', icon: 'fa-users', label: 'Debtors' },
    { href: 'supplierscashier.html', icon: 'fa-handshake', label: 'Suppliers' },
    { href: 'gas_delivery.html', icon: 'fa-truck', label: 'Delivery' },
    { href: 'money transfer.html', icon: 'fa-exchange-alt', label: 'Transfer Money' },
    { divider: true },
    { href: 'cashier_report.html', icon: 'fa-file-alt', label: "Today's Report" },
    { href: 'pos.html', icon: 'fa-shopping-cart', label: 'Cart Shop' },
    { href: 'bank.html', icon: 'fa-cash-register', label: 'Terminal' },
    { href: 'cashierprofile.html', icon: 'fa-user', label: 'Settings' },
    { href: 'cashier.html', icon: 'fa-home', label: 'HOME' }
];

export function mountCashierNav() {
    mountSidebar({ brandLabel: 'JEPE CASHIER', links: CASHIER_LINKS, showSwitchLink: false });
}
