// cashier-nav.js - single source of truth for the cashier-role sidebar.
// Add a new cashier page by adding one entry to CASHIER_LINKS below - every
// page that calls mountCashierNav() picks it up automatically.
// cashier.html itself is excluded - it keeps its own distinct full-screen
// nav-overlay/nav-grid launcher menu.

import { mountSidebar } from './nav.js';

const CASHIER_LINKS = [
    { href: 'cashier.html', icon: 'fa-tachometer-alt', label: 'Dashboard' },

    { section: 'Sell' },
    { href: 'cashiergashub.html', icon: 'fa-fire', label: 'Gas Hub' },
    { href: 'pos.html', icon: 'fa-shopping-cart', label: 'Cart Shop' },
    { href: 'bank.html', icon: 'fa-cash-register', label: 'Terminal' },

    { section: 'Money' },
    { href: 'moneyinout.html', icon: 'fa-money-bill-wave', label: 'Money IN/OUT' },
    { href: 'money transfer.html', icon: 'fa-exchange-alt', label: 'Transfer Money' },
    { href: 'shift history cashier.html', icon: 'fa-history', label: 'Shift History' },
    { href: 'cashier_report.html', icon: 'fa-file-alt', label: "Today's Report" },

    { section: 'Inventory' },
    { href: 'cashier_inventory.html', icon: 'fa-plus-circle', label: 'Add Stock' },
    { href: 'sale edit cashier.html', icon: 'fa-edit', label: 'Edit Sales' },
    { href: 'low-stock-cashier.html', icon: 'fa-exclamation-triangle', label: 'Low Stock' },

    { section: 'Customers & Suppliers' },
    { href: 'sales_reports.html', icon: 'fa-chart-line', label: 'Sales History' },
    { href: 'debtors.html', icon: 'fa-users', label: 'Debtors' },
    { href: 'gas_delivery.html', icon: 'fa-truck', label: 'Delivery' },
    { href: 'supplierscashier.html', icon: 'fa-handshake', label: 'Suppliers' },

    { section: 'Account' },
    { href: 'cashierprofile.html', icon: 'fa-user', label: 'Settings' },

    { divider: true },
    { href: 'cashier.html', icon: 'fa-home', label: 'HOME' }
];

export function mountCashierNav() {
    mountSidebar({ brandLabel: 'JEPE CASHIER', links: CASHIER_LINKS, showSwitchLink: false });
}
