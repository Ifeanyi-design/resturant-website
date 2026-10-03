// ============================================================================
//  Staff dashboard
// ============================================================================
//  Shows the numbers a staff member actually acts on: how many orders are in
//  flight, what is waiting on a payment approval, and what is running low.
//
//  The sidebar (including #admin-name and #logout-btn) is rendered by
//  ../js/shell.js, so this file does not build it or bind logout.
// ============================================================================

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'staff') {
    window.location.href = '../index.html';
}


// Orders in these states still need someone to do something about them.
const ACTIVE_STATUSES = ['Pending', 'Preparing', 'Ready'];


function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}


// ============================================================================
//  COUNTS
// ============================================================================

async function loadCounts() {
    const [orders, payments, lowStock] = await Promise.all([
        window.api.get('/api/orders').catch(() => []),
        window.api.get('/api/payments').catch(() => []),
        window.api.get('/api/inventory/low-stock').catch(() => [])
    ]);

    const orderList = Array.isArray(orders) ? orders : [];
    const paymentList = Array.isArray(payments) ? payments : [];

    setText('stat-orders', orderList.length);

    setText('stat-active', orderList.filter(
        order => ACTIVE_STATUSES.includes(order.status)
    ).length);

    setText('stat-pending-payments', paymentList.filter(
        payment => payment.payment_status === 'Pending'
    ).length);

    setText('stat-low-stock', Array.isArray(lowStock) ? lowStock.length : 0);

    return orderList;
}


// ============================================================================
//  ORDERS IN PROGRESS
// ============================================================================

function renderActiveOrders(orders) {
    const body = document.getElementById('active-orders-body');

    if (!body) {
        return;
    }

    const active = orders
        .filter(order => ACTIVE_STATUSES.includes(order.status))
        // Oldest first: the ones waiting longest need attention first.
        .sort((a, b) => a.order_id - b.order_id);

    if (active.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="muted">
                    Nothing in the kitchen right now.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = active.map(order => `
        <tr>
            <td><strong>#${order.order_id}</strong></td>
            <td>${order.customer_name || '—'}</td>
            <td class="muted">${new Date(order.order_date).toLocaleString()}</td>
            <td>
                <span class="status ${order.status.toLowerCase()}">${order.status}</span>
            </td>
            <td>&#8358;${Number(order.total_amount).toLocaleString()}</td>
            <td>
                <a class="action-btn btn-sm"
                   href="orders/view/index.html?id=${order.order_id}">
                    Open
                </a>
            </td>
        </tr>
    `).join('');
}


// ============================================================================
//  START
// ============================================================================

(async () => {
    try {
        const orders = await loadCounts();
        renderActiveOrders(orders);

    } catch (error) {
        console.error(error);

        const body = document.getElementById('active-orders-body');

        if (body) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="muted">Could not load orders.</td>
                </tr>
            `;
        }
    }
})();
