// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));


// Protect admin page
if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}


const tableBody = document.getElementById("supplier-table-body");
const formSection = document.getElementById("supplier-form-section");
const form = document.getElementById("supplier-form");
const addButton = document.getElementById("add-supplier-btn");
const cancelButton = document.getElementById("cancel-btn");
const refreshButton = document.getElementById("refresh-btn");
const formMessage = document.getElementById("form-message");

let editingId = null;


// ===============================
// ADD BUTTON
// ===============================

addButton.addEventListener("click", () => {

    editingId = null;

    form.reset();

    document.getElementById("form-title").textContent =
        "Add Supplier";

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
// LOAD SUPPLIERS
// ===============================

async function loadSuppliers() {

    try {

        const response = await fetch(
            `${API_URL}/suppliers`
        );

        if (!response.ok) {
            throw new Error("Failed to load suppliers");
        }

        const suppliers = await response.json();

        tableBody.innerHTML = "";

        if (suppliers.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        No suppliers found.
                    </td>
                </tr>
            `;

            return;
        }


        suppliers.forEach(supplier => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${supplier.supplier_id}</td>

                <td>${supplier.supplier_name || "-"}</td>

                <td>${supplier.contact_person || "-"}</td>

                <td>${supplier.phone || "-"}</td>

                <td>${supplier.email || "-"}</td>

                <td>${supplier.address || "-"}</td>

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
                    () => editSupplier(supplier.supplier_id)
                );


            row.querySelector(".delete-btn")
                .addEventListener(
                    "click",
                    () => deleteSupplier(supplier.supplier_id)
                );


            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Failed to load suppliers.
                </td>
            </tr>
        `;
    }
}


// ===============================
// ADD / UPDATE SUPPLIER
// ===============================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const supplierName =
        document.getElementById("supplier-name").value.trim();

    const contactPerson =
        document.getElementById("contact-person").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const address =
        document.getElementById("address").value.trim();


    formMessage.textContent = "Saving...";


    try {

        const url = editingId
            ? `${API_URL}/suppliers/${editingId}`
            : `${API_URL}/suppliers`;

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

                supplier_name: supplierName,
                contact_person: contactPerson,
                phone: phone,
                email: email,
                address: address

            })
        });


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Failed to save supplier"
            );
        }


        formMessage.textContent = editingId
            ? "Supplier updated successfully!"
            : "Supplier created successfully!";


        form.reset();

        editingId = null;

        document.getElementById("form-title").textContent =
            "Add Supplier";


        await loadSuppliers();


    } catch (error) {

        console.error(error);

        formMessage.textContent = error.message;
    }

});


// ===============================
// EDIT SUPPLIER
// ===============================

async function editSupplier(id) {

    try {

        const response = await fetch(
            `${API_URL}/suppliers/${id}`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );


        const data = await response.json();


        if (!response.ok) {
            throw new Error(
                data.error || "Failed to load supplier"
            );
        }


        editingId = id;


        document.getElementById("supplier-name").value =
            data.supplier_name || "";

        document.getElementById("contact-person").value =
            data.contact_person || "";

        document.getElementById("phone").value =
            data.phone || "";

        document.getElementById("email").value =
            data.email || "";

        document.getElementById("address").value =
            data.address || "";


        document.getElementById("form-title").textContent =
            "Edit Supplier";

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
// DELETE SUPPLIER
// ===============================

async function deleteSupplier(id) {

    if (
        !confirm(
            "Are you sure you want to delete this supplier?"
        )
    ) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/suppliers/${id}`,
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
                data.error || "Failed to delete supplier"
            );
        }


        alert(
            "Supplier deleted successfully"
        );


        await loadSuppliers();


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
    loadSuppliers
);


// ===============================
// INITIAL LOAD
// ===============================

loadSuppliers();
