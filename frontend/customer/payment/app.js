// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;


// ========================================
// GET ORDER ID FROM URL
// ========================================

const params = new URLSearchParams(window.location.search);

const orderId = params.get("order_id");


// ========================================
// PAGE ELEMENTS
// ========================================

const orderIdElement =
    document.getElementById("order-id");

const customerNameElement =
    document.getElementById("customer-name");

const orderStatusElement =
    document.getElementById("order-status");

const orderTotalElement =
    document.getElementById("order-total");

const bankNameElement =
    document.getElementById("bank-name");

const accountNameElement =
    document.getElementById("account-name");

const accountNumberElement =
    document.getElementById("account-number");

const copyAccountButton =
    document.getElementById("copy-account-btn");

const copyMessage =
    document.getElementById("copy-message");

const transferMadeButton =
    document.getElementById("transfer-made-btn");


// ========================================
// LOAD ORDER
// ========================================

async function loadOrder() {

    if (!orderId) {

        alert("Order ID is missing.");

        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/orders/${orderId}`
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error || "Failed to load order"
            );
        }


        const order = data.order;


        // Display order information

        orderIdElement.textContent =
            `#${order.order_id}`;

        customerNameElement.textContent =
            order.customer_name;

        orderStatusElement.textContent =
            order.status;

        orderTotalElement.textContent =
            `₦${Number(order.total_amount).toLocaleString()}`;


    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Failed to load order information."
        );
    }
}


// ========================================
// LOAD RESTAURANT BANK ACCOUNT
// ========================================

async function loadBankAccount() {

    try {

        const response = await fetch(
            `${API_URL}/bank-accounts`
        );

        const accounts = await response.json();

        if (!response.ok) {

            throw new Error(
                accounts.error ||
                "Failed to load bank account"
            );
        }


        // Find active account

        const activeAccount =
            accounts.find(
                account =>
                    Number(account.is_active) === 1
            );


        if (!activeAccount) {

            bankNameElement.textContent =
                "No active account";

            accountNameElement.textContent =
                "-";

            accountNumberElement.textContent =
                "-";

            transferMadeButton.disabled = true;

            return;
        }


        bankNameElement.textContent =
            activeAccount.bank_name;

        accountNameElement.textContent =
            activeAccount.account_name;

        accountNumberElement.textContent =
            activeAccount.account_number;


    } catch (error) {

        console.error(error);

        bankNameElement.textContent =
            "Failed to load";

        accountNameElement.textContent =
            "Failed to load";

        accountNumberElement.textContent =
            "Failed to load";
    }
}


// ========================================
// COPY ACCOUNT NUMBER
// ========================================

copyAccountButton.addEventListener(
    "click",
    async function () {

        const accountNumber =
            accountNumberElement.textContent.trim();

        if (
            !accountNumber ||
            accountNumber === "Loading..." ||
            accountNumber === "-"
        ) {

            return;
        }


        try {

            await navigator.clipboard.writeText(
                accountNumber
            );

            copyMessage.textContent =
                "Account number copied successfully.";

        } catch (error) {

            console.error(error);

            copyMessage.textContent =
                "Unable to copy account number.";
        }
    }
);


// ========================================
// I HAVE MADE THE TRANSFER
// ========================================

transferMadeButton.addEventListener(
    "click",
    async function () {

        if (!orderId) {

            alert("Order ID is missing.");

            return;
        }


        transferMadeButton.disabled = true;

        transferMadeButton.textContent =
            "Submitting...";


        try {

            // Get the order again

            const orderResponse =
                await fetch(
                    `${API_URL}/orders/${orderId}`
                );

            const orderData =
                await orderResponse.json();


            if (!orderResponse.ok) {

                throw new Error(
                    orderData.error ||
                    "Failed to load order"
                );
            }


            const order =
                orderData.order;


            // Create pending transfer payment

            const paymentResponse =
                await fetch(
                    `${API_URL}/payments`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            order_id:
                                Number(order.order_id),

                            payment_method:
                                "Transfer",

                            amount:
                                Number(order.total_amount),

                            payment_status:
                                "Pending"
                        })
                    }
                );


            const paymentData =
                await paymentResponse.json();


            if (!paymentResponse.ok) {

                throw new Error(
                    paymentData.error ||
                    "Failed to submit payment"
                );
            }


            // Payment submitted successfully

            document.querySelector(
                ".payment-container"
            ).innerHTML = `

                <div class="success-message">

                    <h2>
                        Payment Submitted
                    </h2>

                    <p>
                        Your bank transfer has been
                        submitted successfully.
                    </p>

                    <p>
                        <strong>
                            Order ID:
                        </strong>
                        #${order.order_id}
                    </p>

                    <p>
                        <strong>
                            Payment Status:
                        </strong>
                        Pending
                    </p>

                    <p>
                        Your payment will be verified
                        by the restaurant.
                    </p>

                    <a
                        href="../orders/index.html"
                        class="back-btn">

                        View My Orders

                    </a>

                </div>
            `;


        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Failed to submit payment."
            );

            transferMadeButton.disabled = false;

            transferMadeButton.textContent =
                "I Have Made the Transfer";
        }
    }
);


// ========================================
// LOAD PAGE DATA
// ========================================

loadOrder();

loadBankAccount();
