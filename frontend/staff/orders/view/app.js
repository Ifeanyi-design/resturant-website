// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const orderDetails = document.getElementById('order-details');

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');

async function loadOrder() {
    if (!orderId) {
        orderDetails.innerHTML = '<p>Order ID is missing.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load order');
        }

        const order = data.order;
        const items = data.items;

        let itemsHTML = '';

        items.forEach(item => {
            itemsHTML += `
                <tr>
                    <td>${item.item_name}</td>
                    <td>${item.quantity}</td>
                    <td>₦${Number(item.unit_price).toLocaleString()}</td>
                    <td>₦${Number(item.subtotal).toLocaleString()}</td>
                </tr>
            `;
        });

        orderDetails.innerHTML = `
            <div class="order-card">
                <h2>Order #${order.order_id}</h2>

                <p class="info">
                    <strong>Customer:</strong>
                    ${order.customer_name}
                </p>

                <p class="info">
                    <strong>Date:</strong>
                    ${new Date(order.order_date).toLocaleString()}
                </p>

                <p class="info">
                    <strong>Status:</strong>
                    <span class="status">${order.status}</span>
                </p>

                <p class="info">
                    <strong>Total:</strong>
                    ₦${Number(order.total_amount).toLocaleString()}
                </p>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>
            </div>

            <p class="total">
                Order Total:
                ₦${Number(order.total_amount).toLocaleString()}
            </p>
        `;

    } catch (error) {
        console.error(error);

        orderDetails.innerHTML = `
            <div class="order-card">
                <p>Failed to load order details.</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

loadOrder();
