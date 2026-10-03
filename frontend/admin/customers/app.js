// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));


// ===============================
// ADMIN PROTECTION
// ===============================

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}


// ===============================
// ELEMENTS
// ===============================

const tableBody =
    document.getElementById("customer-table-body");

const formSection =
    document.getElementById("customer-form-section");

const form =
    document.getElementById("customer-form");

const addButton =
    document.getElementById("add-customer-btn");

const cancelButton =
    document.getElementById("cancel-btn");

const refreshButton =
    document.getElementById("refresh-btn");

const formMessage =
    document.getElementById("form-message");

let editingId = null;


// ===============================
// ADD BUTTON
// ===============================

addButton.addEventListener("click", () => {

    editingId = null;

    form.reset();

    document.getElementById("form-title").textContent =
        "Add Customer";

    formMessage.textContent = "";

    formSection.style.display = "block";

    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


// ===============================
// CANCEL BUTTON
// ===============================

cancelButton.addEventListener("click", () => {

    formSection.style.display = "none";

    editingId = null;

    form.reset();

    formMessage.textContent = "";
});


// ===============================
// LOAD CUSTOMERS
// ===============================

async function loadCustomers() {

    try {

        const response = await fetch(
            `${API_URL}/customers`
        );

        if (!response.ok) {
            throw new Error("Failed to load customers");
        }

        const customers = await response.json();

        tableBody.innerHTML = "";


        if (customers.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        No customers found.
                    </td>
                </tr>
            `;

            return;
        }


        customers.forEach(customer => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${customer.customer_id}</td>

                <td>${customer.first_name}</td>

                <td>${customer.last_name}</td>

                <td>${customer.phone || "-"}</td>

                <td>${customer.email || "-"}</td>

                <td>

                    <button class="edit-btn">
                        Edit
                    </button>

                    <button class="delete-btn">
                        Delete
                    </button>

                </td>
            `;


            row.querySelector(".edit-btn")
                .addEventListener(
                    "click",
                    () => editCustomer(customer.customer_id)
                );


            row.querySelector(".delete-btn")
                .addEventListener(
                    "click",
                    () => deleteCustomer(customer.customer_id)
                );


            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load customers.
                </td>
            </tr>
        `;
    }
}


// ===============================
// CREATE / UPDATE CUSTOMER
// ===============================

form.addEventListener("submit", async (event) => {

    event.preventDefault();


    const firstName =
        document.getElementById("first-name").value.trim();

    const lastName =
        document.getElementById("last-name").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const email =
        document.getElementById("email").value.trim();


    formMessage.textContent = "Saving...";


    try {

        const url = editingId
            ? `${API_URL}/customers/${editingId}`
            : `${API_URL}/customers`;

        const method = editingId
            ? "PUT"
            : "POST";


        const response = await fetch(url, {

            method,

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({

                first_name: firstName,
                last_name: lastName,
                phone: phone,
                email: email

            })
        });


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Failed to save customer"
            );
        }


        formMessage.textContent = editingId
            ? "Customer updated successfully!"
            : "Customer created successfully!";


        form.reset();

        editingId = null;

        document.getElementById("form-title").textContent =
            "Add Customer";


        await loadCustomers();


    } catch (error) {

        console.error(error);

        formMessage.textContent =
            error.message;
    }
});


// ===============================
// EDIT CUSTOMER
// ===============================

async function editCustomer(id) {

    try {

        const response = await fetch(
            `${API_URL}/customers/${id}`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Failed to load customer"
            );
        }


        editingId = id;


        document.getElementById("first-name").value =
            data.first_name || "";

        document.getElementById("last-name").value =
            data.last_name || "";

        document.getElementById("phone").value =
            data.phone || "";

        document.getElementById("email").value =
            data.email || "";


        document.getElementById("form-title").textContent =
            "Edit Customer";

        formMessage.textContent = "";

        formSection.style.display = "block";

        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    } catch (error) {

        console.error(error);

        alert(
            "Edit error: " + error.message
        );
    }
}


// ===============================
// DELETE CUSTOMER
// ===============================

async function deleteCustomer(id) {

    if (
        !confirm(
            "Are you sure you want to delete this customer?"
        )
    ) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/customers/${id}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Failed to delete customer"
            );
        }


        alert(
            "Customer deleted successfully"
        );


        await loadCustomers();


    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


// ===============================
// REFRESH
// ===============================

refreshButton.addEventListener(
    "click",
    loadCustomers
);


// ===============================
// INITIAL LOAD
// ===============================

loadCustomers();
