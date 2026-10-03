const customer =
    JSON.parse(localStorage.getItem("customer"));

const profileInfo =
    document.getElementById("profile-info");


// ========================================
// CHECK LOGIN
// ========================================

if (!customer) {

    window.location.href =
        "../../index.html";

}


// ========================================
// DISPLAY PROFILE
// ========================================

if (customer) {

    // Fill the header with the real name and initials, so the card is not
    // headed by a generic label above the customer's own details.
    const fullName =
        `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

    const nameEl = document.getElementById("profile-name");
    const avatarEl = document.getElementById("profile-avatar");

    if (nameEl && fullName) {
        nameEl.textContent = fullName;
    }

    if (avatarEl) {
        const initials =
            `${(customer.first_name || "?")[0]}${(customer.last_name || "")[0] || ""}`
                .toUpperCase();

        avatarEl.textContent = initials;
    }

    profileInfo.innerHTML = `

        <div class="profile-row">

            <strong>First Name</strong>

            <span>
                ${customer.first_name}
            </span>

        </div>


        <div class="profile-row">

            <strong>Last Name</strong>

            <span>
                ${customer.last_name}
            </span>

        </div>


        <div class="profile-row">

            <strong>Phone Number</strong>

            <span>
                ${customer.phone || "Not provided"}
            </span>

        </div>


        <div class="profile-row">

            <strong>Email</strong>

            <span>
                ${customer.email}
            </span>

        </div>

    `;

}


// ========================================
// LOGOUT
// ========================================

document
    .getElementById("logout-btn")
    .addEventListener("click", () => {

        localStorage.removeItem("token");
        localStorage.removeItem("customer");
        localStorage.removeItem("customer_id");
        localStorage.removeItem("cart");

        window.location.href =
            "../../index.html";

    });
