// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}

const tableBody =
    document.getElementById("order-table-body");

const refreshButton =
    document.getElementById("refresh-btn");


// ========================================
// LOAD ORDERS
// ========================================

async function loadOrders() {

    try {

        const response =
            await fetch(
                `${API_URL}/orders`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load orders"
            );
        }

        const orders =
            await response.json();

        tableBody.innerHTML = "";


        if (orders.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        No orders found.
                    </td>
                </tr>
            `;

            return;
        }


        orders.forEach(order => {

            const row =
                document.createElement("tr");

            row.innerHTML = `

                <td>
                    ${order.order_id}
                </td>

                <td>
                    ${order.customer_name}
                </td>

                <td>
                    ${new Date(
                        order.order_date
                    ).toLocaleString()}
                </td>

                <td>
                    ${order.status}
                </td>

                <td>
                    ₦${Number(
                        order.total_amount
                    ).toLocaleString()}
                </td>

                <td>

                    <button
                        type="button"
                        class="view-btn"
                        onclick="viewOrder(${order.order_id})">
                        View
                    </button>

                </td>
            `;

            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load orders.
                </td>
            </tr>
        `;
    }
}


// ========================================
// VIEW ORDER
// ========================================

function viewOrder(orderId) {

    window.location.href =
        `view/index.html?id=${orderId}`;

}


// ========================================
// REFRESH
// ========================================

refreshButton.addEventListener(
    "click",
    loadOrders
);


// ========================================
// START
// ========================================

loadOrders();
