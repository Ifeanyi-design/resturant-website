// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const cart =
    JSON.parse(localStorage.getItem("cart")) || [];

const customer =
    JSON.parse(localStorage.getItem("customer")) || null;

const customerId =
    localStorage.getItem("customer_id");

const form =
    document.getElementById("checkout-form");

const summaryContainer =
    document.getElementById("summary-container");


// ===============================
// CHECK CUSTOMER LOGIN
// ===============================

if (!customer || !customerId) {

    alert("Please sign in as a customer first.");

    window.location.href = "../../index.html";

}


// ===============================
// FILL CUSTOMER INFORMATION
// ===============================

if (customer) {

    document.getElementById("first-name").value =
        customer.first_name || "";

    document.getElementById("last-name").value =
        customer.last_name || "";

    document.getElementById("phone").value =
        customer.phone || "";

    document.getElementById("email").value =
        customer.email || "";

}


// ===============================
// LOAD ORDER SUMMARY
// ===============================

async function loadSummary() {

    if (cart.length === 0) {

        summaryContainer.innerHTML = `
            <p>Your cart is empty.</p>
        `;

        return;
    }

    try {

        const response =
            await fetch(`${API_URL}/menu`);

        const menuItems =
            await response.json();

        let total = 0;
        let html = "";

        cart.forEach(cartItem => {

            const item =
                menuItems.find(
                    menuItem =>
                        Number(menuItem.item_id) ===
                        Number(cartItem.item_id)
                );

            if (!item) return;

            const price =
                Number(item.price);

            const subtotal =
                price * cartItem.quantity;

            total += subtotal;

            html += `
                <div class="summary-item">

                    <strong>
                        ${item.item_name}
                    </strong>

                    <p>
                        Quantity: ${cartItem.quantity}
                    </p>

                    <p>
                        ₦${subtotal.toLocaleString()}
                    </p>

                </div>
            `;

        });

        html += `
            <div class="summary-total">
                Total:
                ₦${total.toLocaleString()}
            </div>
        `;

        summaryContainer.innerHTML = html;

    } catch (error) {

        console.error(error);

        summaryContainer.innerHTML =
            "<p>Failed to load order.</p>";

    }
}


// ===============================
// CREATE ORDER
// ===============================

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        if (cart.length === 0) {

            alert("Your cart is empty.");

            return;
        }

        const button =
            document.querySelector(".place-order-btn");

        button.disabled = true;
        button.textContent = "Placing Order...";


        try {

            const items =
                cart.map(item => ({
                    item_id: Number(item.item_id),
                    quantity: Number(item.quantity)
                }));


            const response =
                await fetch(`${API_URL}/orders`, {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        customer_id:
                            Number(customerId),

                        items: items

                    })

                });


            const order =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    order.error ||
                    order.message ||
                    "Failed to create order"
                );

            }


            // Save customer ID
            localStorage.setItem(
                "customer_id",
                String(customerId)
            );


            // Clear cart
            localStorage.removeItem("cart");


            // ========================================
            // SHOW ORDER CREATED MESSAGE
            // ========================================

            document.querySelector(
                ".customer-details"
            ).innerHTML = `

                <div class="success-message">

                    <h2>
                        Order Created Successfully!
                    </h2>

                    <p>
                        Order ID:
                        <strong>
                            #${order.order_id}
                        </strong>
                    </p>

                    <p>
                        Order Status:
                        <strong>Pending</strong>
                    </p>

                    <p>
                        Payment Status:
                        <strong>Not Paid</strong>
                    </p>

                    <br>

                    <a
                        href="../payment/index.html?order_id=${order.order_id}"
                        class="back-btn"
                    >
                        Proceed to Payment
                    </a>

                </div>

            `;


            // ========================================
            // REMOVE OLD ORDER SUMMARY
            // ========================================

            summaryContainer.innerHTML = `

                <div class="payment-notice">

                    <h2>Payment Required</h2>

                    <p>
                        Your order has been created,
                        but payment has not been made yet.
                    </p>

                    <p>
                        Click
                        <strong>Proceed to Payment</strong>
                        to choose your payment method.
                    </p>

                </div>

            `;

        } catch (error) {

            console.error(error);

            alert(error.message);

            button.disabled = false;

            button.textContent =
                "Place Order";

        }

    }
);


loadSummary();
