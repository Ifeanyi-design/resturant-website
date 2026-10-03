// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const ordersContainer =
    document.getElementById("orders-container");

const customerId =
    localStorage.getItem("customer_id");


// ========================================
// LOAD ORDERS
// ========================================

async function loadOrders() {

    if (!customerId) {

        ordersContainer.innerHTML = `
            <div class="empty">
                <p>Please sign in as a customer first.</p>

                <br>

                <a href="../../index.html">
                    Sign In
                </a>
            </div>
        `;

        return;
    }


    try {

        // Get customer's orders
        const ordersResponse =
            await fetch(
                `${API_URL}/orders/customer/${customerId}`
            );


        if (!ordersResponse.ok) {
            throw new Error("Failed to load orders");
        }


        const orders =
            await ordersResponse.json();


        if (orders.length === 0) {

            ordersContainer.innerHTML = `
                <div class="empty">

                    <p>
                        You have not placed any orders yet.
                    </p>

                    <br>

                    <a href="../index.html">
                        Browse Menu
                    </a>

                </div>
            `;

            return;
        }


        ordersContainer.innerHTML =
            "<p>Loading order details...</p>";


        let html = "";


        // Get details for every order
        for (const order of orders) {

            const detailResponse =
                await fetch(
                    `${API_URL}/orders/${order.order_id}`
                );


            const detail =
                await detailResponse.json();


            // The order list already carries the latest payment status, so
            // there is no separate /api/payments call here. That endpoint is
            // staff-only, and a customer reading every payment in the system
            // would be a data leak anyway.
            const paymentStatus =
                order.payment_status || "Unpaid";


            let itemsHTML = "";


            if (
                detail.items &&
                detail.items.length > 0
            ) {

                detail.items.forEach(item => {

                    itemsHTML += `

                        <div class="order-item">

                            <div>

                                <strong>
                                    ${item.item_name}
                                </strong>

                                <p>
                                    Quantity:
                                    ${item.quantity}
                                </p>

                                <p>
                                    Unit Price:
                                    ₦${Number(
                                        item.unit_price
                                    ).toLocaleString()}
                                </p>

                            </div>

                            <strong>
                                ₦${Number(
                                    item.subtotal
                                ).toLocaleString()}
                            </strong>

                        </div>

                    `;

                });

            }


            const orderStatus =
                order.status.toLowerCase();


            const paymentClass =
                paymentStatus.toLowerCase();


            html += `

                <div class="order-card">

                    <h3>
                        Order #${order.order_id}
                    </h3>


                    <div class="order-row">

                        Date:
                        ${new Date(
                            order.order_date
                        ).toLocaleString()}

                    </div>


                    <div class="order-row">

                        Order Status:

                        <span
                            class="status ${orderStatus}">
                            ${order.status}
                        </span>

                    </div>


                    <div class="order-row">

                        Payment Status:

                        <span
                            class="payment-status ${paymentClass}">
                            ${paymentStatus}
                        </span>

                    </div>


                    <hr>


                    <h4>
                        Items
                    </h4>


                    <div class="items-list">

                        ${itemsHTML}

                    </div>


                    <div class="order-total">

                        Total:
                        ₦${Number(
                            order.total_amount
                        ).toLocaleString()}

                    </div>


                    ${
                        paymentStatus !== "Paid"
                        ? `
                            <a
                                class="pay-btn"
                                href="../payment/index.html?order_id=${order.order_id}"
                            >
                                Pay Now
                            </a>
                        `
                        : ""
                    }


                </div>

            `;

        }


        ordersContainer.innerHTML = html;


    } catch (error) {

        console.error(error);

        ordersContainer.innerHTML = `
            <div class="empty">
                Failed to load your orders.
            </div>
        `;

    }

}


loadOrders();
