// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../../index.html";
}

const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");


// ========================================
// LOAD ORDER
// ========================================

async function loadOrder() {

    if (!orderId) {
        alert("Order ID not found.");
        return;
    }

    try {

        const orderResponse = await fetch(
            `${API_URL}/orders/${orderId}`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await orderResponse.json();

        if (!orderResponse.ok) {
            throw new Error(
                data.error || "Failed to load order"
            );
        }


        // ORDER INFORMATION

        document.getElementById("order-id").textContent =
            data.order.order_id;

        document.getElementById("customer-name").textContent =
            data.order.customer_name;

        document.getElementById("order-date").textContent =
            new Date(
                data.order.order_date
            ).toLocaleString();

        document.getElementById("status").textContent =
            data.order.status;

        document.getElementById("total").textContent =
            Number(
                data.order.total_amount
            ).toLocaleString();


        // ORDER ITEMS

        const tableBody =
            document.getElementById(
                "items-table-body"
            );

        tableBody.innerHTML = "";

        data.items.forEach(item => {

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>${item.item_name}</td>

                <td>${item.quantity}</td>

                <td>
                    ₦${Number(
                        item.unit_price
                    ).toLocaleString()}
                </td>

                <td>
                    ₦${Number(
                        item.subtotal
                    ).toLocaleString()}
                </td>
            `;

            tableBody.appendChild(row);
        });


        // ========================================
        // PAYMENT STATE
        // ========================================

        const paymentsResponse =
            await fetch(`${API_URL}/payments`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

        const payments = await paymentsResponse.json();

        const payment = Array.isArray(payments)
            ? payments.find(
                p =>
                    Number(p.order_id) ===
                    Number(orderId)
              )
            : null;

        const paymentSettled =
            !!payment && payment.payment_status === "Paid";


        // ========================================
        // NEXT-STEP BUTTONS
        // ========================================
        // The server tells us which transitions are legal from the current
        // status, so these buttons are driven by the API rather than by rules
        // hardcoded here. The lifecycle lives in
        // backend/domain/orderLifecycle.js.

        const nextStatuses =
            data.allowed_next_statuses || [];

        const processSection =
            document.getElementById("process-section");

        const message =
            document.getElementById("message");

        processSection.innerHTML = "";
        message.textContent = "";


        if (nextStatuses.length === 0) {

            processSection.innerHTML = `
                <p class="completed">
                    This order is
                    ${data.order.status.toLowerCase()}
                    and cannot change any further.
                </p>
            `;

            return;
        }


        // Completing an order consumes stock, so it needs a settled payment.
        // The button is rendered but disabled, with the reason shown, rather
        // than hidden - whoever is looking needs to know WHY they cannot
        // proceed, not just that the option is missing.
        const blockedByPayment =
            nextStatuses.includes("Completed") &&
            !paymentSettled;

        processSection.innerHTML = nextStatuses
            .map(status => {

                const isCompletion = status === "Completed";

                const disabled =
                    isCompletion && blockedByPayment
                        ? "disabled"
                        : "";

                const buttonClass =
                    status === "Cancelled"
                        ? "cancel-btn"
                        : "process-btn";

                return `
                    <button
                        class="${buttonClass}"
                        data-status="${status}"
                        ${disabled}
                    >
                        Move to ${status}
                    </button>
                `;
            })
            .join("");


        if (blockedByPayment) {

            processSection.innerHTML += `
                <p class="warning">
                    Payment must be approved before
                    this order can be completed.
                </p>
            `;
        }


        processSection
            .querySelectorAll("button[data-status]")
            .forEach(button => {

                button.addEventListener("click", function () {
                    setStatus(this.dataset.status);
                });
            });


    } catch (error) {

        console.error(error);

        document.getElementById(
            "items-table-body"
        ).innerHTML = `
            <tr>
                <td colspan="4">
                    Failed to load order details.
                </td>
            </tr>
        `;
    }
}


// ========================================
// CHANGE ORDER STATUS  (FR5)
// ========================================

async function setStatus(status) {

    const completionNote =
        status === "Completed"
            ? "\n\nThis will deduct the order's ingredients from inventory."
            : "";

    const confirmed = confirm(
        `Move order #${orderId} to "${status}"?${completionNote}`
    );

    if (!confirmed) {
        return;
    }

    const buttons = document.querySelectorAll(
        "#process-section button[data-status]"
    );

    buttons.forEach(button => {
        button.disabled = true;
    });


    try {

        const response = await fetch(
            `${API_URL}/orders/${orderId}/status`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: status })
            }
        );

        const result = await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to update the order"
            );
        }


        document.getElementById("message").textContent =
            result.message || `Order moved to ${status}.`;


        // Re-read the order so the status, the buttons and the allowed next
        // steps all come back from the server in one consistent state.
        loadOrder();


    } catch (error) {

        console.error(error);

        alert(error.message);

        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}


// ========================================
// START
// ========================================

loadOrder();
