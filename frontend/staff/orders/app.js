// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const ordersTable = document.getElementById('orders-table');

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`);

        if (!response.ok) {
            throw new Error('Failed to load orders');
        }

        const orders = await response.json();

        ordersTable.innerHTML = '';

        if (orders.length === 0) {
            ordersTable.innerHTML = `
                <tr>
                    <td colspan="6">No orders found.</td>
                </tr>
            `;
            return;
        }

        orders.forEach(order => {
            const row = document.createElement('tr');

            const date = new Date(order.order_date).toLocaleString();

            const statusClass =
                order.status.toLowerCase() === 'completed'
                    ? 'completed'
                    : 'pending';

            let actions = `
                <button
                    class="action-btn view-btn"
                    onclick="viewOrder(${order.order_id})"
                >
                    View
                </button>
            `;

            if (order.status.toLowerCase() === 'pending') {
                actions += `
                    <button
                        class="action-btn process-btn"
                        onclick="processOrder(${order.order_id})"
                    >
                        Process
                    </button>
                `;
            }

            row.innerHTML = `
                <td>${order.order_id}</td>
                <td>${order.customer_name}</td>
                <td>${date}</td>
                <td>
                    <span class="status ${statusClass}">
                        ${order.status}
                    </span>
                </td>
                <td>₦${Number(order.total_amount).toLocaleString()}</td>
                <td>${actions}</td>
            `;

            ordersTable.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        ordersTable.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load orders.
                </td>
            </tr>
        `;
    }
}

function viewOrder(orderId) {
    window.location.href = `view/index.html?id=${orderId}`;
}

async function processOrder(orderId) {
    const confirmed = confirm(
        `Are you sure you want to process Order #${orderId}?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_URL}/orders/${orderId}/process`,
            {
                method: 'POST'
            }
        );

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || 'Failed to process order');
            return;
        }

        alert('Order processed successfully');

        loadOrders();

    } catch (error) {
        console.error(error);
        alert('Could not connect to the server');
    }
}

loadOrders();
