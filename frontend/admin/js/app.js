// ============================================================================
//  Admin dashboard
// ============================================================================
//  Headline counts, an orders-by-status donut, and the low-stock list.
//
//  The sidebar (including #admin-name and #logout-btn) is rendered by
//  ../js/shell.js, so this file does not build it or bind logout.
//
//  All requests go through window.api (from ../js/api.js), which attaches the
//  JWT and centralises error handling.
// ============================================================================

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'admin') {
    window.location.href = '../index.html';
}


// ============================================================================
//  COUNTS
// ============================================================================

// [element id, endpoint]. Orders is handled separately below because the same
// response also feeds the chart - no point requesting it twice.
const COUNTERS = [
    ['menu-count', '/api/menu'],
    ['category-count', '/api/categories'],
    ['customer-count', '/api/customers'],
    ['inventory-count', '/api/inventory'],
    ['supplier-count', '/api/suppliers']
];

const ORDER_STATUSES = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];


async function loadCounts() {
    const jobs = COUNTERS.map(async ([elementId, endpoint]) => {
        const el = document.getElementById(elementId);

        if (!el) {
            return;
        }

        try {
            const rows = await window.api.get(endpoint);
            el.textContent = Array.isArray(rows) ? rows.length : '0';
        } catch (error) {
            console.error(endpoint, error);
            el.textContent = '!';
        }
    });

    // Orders: one request, used for both the tile and the donut.
    jobs.push((async () => {
        const el = document.getElementById('order-count');

        try {
            const orders = await window.api.get('/api/orders');
            const list = Array.isArray(orders) ? orders : [];

            if (el) {
                el.textContent = list.length;
            }

            renderOrdersChart(list);

        } catch (error) {
            console.error('/api/orders', error);
            if (el) {
                el.textContent = '!';
            }
            renderOrdersChart([]);
        }
    })());

    await Promise.all(jobs);
}


// ============================================================================
//  ORDERS BY STATUS
// ============================================================================

function renderOrdersChart(orders) {
    const container = document.getElementById('orders-chart');

    if (!container || !window.charts) {
        return;
    }

    const counts = {};

    ORDER_STATUSES.forEach(status => {
        counts[status] = 0;
    });

    orders.forEach(order => {
        if (Object.prototype.hasOwnProperty.call(counts, order.status)) {
            counts[order.status] += 1;
        }
    });

    window.charts.donut(
        container,
        ORDER_STATUSES.map(status => ({
            label: status,
            value: counts[status],
            tone: status.toLowerCase()
        })),
        { caption: 'ORDERS' }
    );
}


// ============================================================================
//  LOW STOCK  (FR9)
// ============================================================================

async function loadLowStock() {
    const body = document.getElementById('low-stock-body');

    if (!body) {
        return;
    }

    try {
        const items = await window.api.get('/api/inventory/low-stock');

        if (!Array.isArray(items) || items.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="5" class="muted">
                        Every item is above its reorder level.
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = items.map(item => `
            <tr>
                <td>${item.item_name}</td>
                <td><span class="status low">${Number(item.quantity_in_stock)}</span></td>
                <td>${Number(item.reorder_level)}</td>
                <td>${item.unit}</td>
                <td>${item.supplier_name || '—'}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error(error);

        body.innerHTML = `
            <tr>
                <td colspan="5" class="muted">Could not load stock levels.</td>
            </tr>
        `;
    }
}


// ============================================================================
//  START
// ============================================================================

loadCounts();
loadLowStock();
