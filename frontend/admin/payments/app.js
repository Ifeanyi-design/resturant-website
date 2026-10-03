// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const paymentsBody =
    document.getElementById("payments-body");

const message =
    document.getElementById("message");

const refreshBtn =
    document.getElementById("refresh-btn");


// ========================================
// LOAD PAYMENTS
// ========================================

async function loadPayments() {

    paymentsBody.innerHTML = `
        <tr>
            <td colspan="7">
                Loading payments...
            </td>
        </tr>
    `;

    try {

        const response =
            await fetch(`${API_URL}/payments`);

        if (!response.ok) {
            throw new Error(
                "Failed to load payments"
            );
        }

        const payments =
            await response.json();

        if (payments.length === 0) {

            paymentsBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        No payments found.
                    </td>
                </tr>
            `;

            return;
        }

        paymentsBody.innerHTML =
            payments.map(payment => {

                const status =
                    payment.payment_status;

                const statusClass =
                    status.toLowerCase();

                const approveButton =
                    status === "Pending"
                        ? `
                            <button
                                class="approve-btn"
                                onclick="approvePayment(${payment.payment_id})"
                            >
                                Approve Payment
                            </button>
                        `
                        : `
                            <span>—</span>
                        `;

                return `
                    <tr>

                        <td>
                            #${payment.payment_id}
                        </td>

                        <td>
                            #${payment.order_id}
                        </td>

                        <td>
                            ${payment.customer_name}
                        </td>

                        <td>
                            ₦${Number(
                                payment.amount
                            ).toLocaleString()}
                        </td>

                        <td>
                            ${payment.payment_method}
                        </td>

                        <td>
                            <span
                                class="status ${statusClass}"
                            >
                                ${status}
                            </span>
                        </td>

                        <td>
                            ${approveButton}
                        </td>

                    </tr>
                `;

            }).join("");

    } catch (error) {

        console.error(error);

        paymentsBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Failed to load payments.
                </td>
            </tr>
        `;
    }
}


// ========================================
// APPROVE PAYMENT
// ========================================

async function approvePayment(paymentId) {

    const confirmed =
        confirm(
            `Approve payment #${paymentId}?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_URL}/payments/${paymentId}/approve`,
                {
                    method: "PUT"
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                "Failed to approve payment"
            );
        }

        message.className = "message";

        message.textContent =
            `Payment #${paymentId} approved successfully.`;

        setTimeout(() => {
            message.textContent = "";
        }, 3000);

        await loadPayments();

    } catch (error) {

        console.error(error);

        message.className = "error";

        message.textContent =
            error.message;

    }
}


// ========================================
// REFRESH
// ========================================

refreshBtn.addEventListener(
    "click",
    loadPayments
);


// ========================================
// INITIAL LOAD
// ========================================

loadPayments();
