// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}


const tableBody =
    document.getElementById("inventory-table-body");

const formSection =
    document.getElementById("inventory-form-section");

const form =
    document.getElementById("inventory-form");

const addButton =
    document.getElementById("add-inventory-btn");

const cancelButton =
    document.getElementById("cancel-btn");

const formMessage =
    document.getElementById("form-message");

const supplierSelect =
    document.getElementById("supplier-id");


let editingId = null;


// ============================
// ADD BUTTON
// ============================

addButton.addEventListener("click", () => {

    editingId = null;

    form.reset();

    document.getElementById("form-title").textContent =
        "Add Inventory Item";

    formMessage.textContent = "";

    formSection.style.display = "block";

    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


// ============================
// CANCEL
// ============================

cancelButton.addEventListener("click", () => {

    formSection.style.display = "none";

    editingId = null;

    form.reset();

    formMessage.textContent = "";
});


// ============================
// LOAD SUPPLIERS
// ============================

async function loadSuppliers() {

    try {

        const response =
            await fetch(`${API_URL}/suppliers`);

        if (!response.ok) {
            throw new Error("Failed to load suppliers");
        }

        const suppliers =
            await response.json();

        supplierSelect.innerHTML = `
            <option value="">
                Select supplier
            </option>
        `;

        suppliers.forEach(supplier => {

            const option =
                document.createElement("option");

            option.value =
                supplier.supplier_id;

            option.textContent =
                supplier.supplier_name;

            supplierSelect.appendChild(option);
        });

    } catch (error) {

        console.error(
            "Supplier loading error:",
            error
        );
    }
}


// ============================
// LOAD INVENTORY
// ============================

async function loadInventory() {

    try {

        const response =
            await fetch(`${API_URL}/inventory`);

        if (!response.ok) {
            throw new Error(
                "Failed to load inventory"
            );
        }

        const inventory =
            await response.json();

        tableBody.innerHTML = "";


        if (inventory.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        No inventory items found.
                    </td>
                </tr>
            `;

            return;
        }


        inventory.forEach(item => {

            const quantity =
                Number(item.quantity_in_stock);

            const reorderLevel =
                Number(item.reorder_level);

            const isLowStock =
                quantity <= reorderLevel;


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${item.inventory_id}
                </td>

                <td>
                    ${item.item_name}
                </td>

                <td>
                    ${item.unit}
                </td>

                <td>
                    ${quantity.toLocaleString()}
                </td>

                <td>
                    ${reorderLevel.toLocaleString()}
                </td>

                <td>
                    ₦${Number(
                        item.unit_cost
                    ).toLocaleString()}
                </td>

                <td>
                    ${item.supplier_name}
                </td>

                <td class="${
                    isLowStock
                        ? "low-stock"
                        : "normal-stock"
                }">

                    ${
                        isLowStock
                            ? "Low Stock"
                            : "Normal"
                    }

                </td>

                <td>

                    <button
                        class="edit-btn">
                        Edit
                    </button>

                    <button
                        class="delete-btn">
                        Delete
                    </button>

                </td>
            `;


            row.querySelector(".edit-btn")
                .addEventListener(
                    "click",
                    () => editInventoryItem(
                        item.inventory_id
                    )
                );


            row.querySelector(".delete-btn")
                .addEventListener(
                    "click",
                    () => deleteInventoryItem(
                        item.inventory_id
                    )
                );


            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="9">
                    Failed to load inventory.
                </td>
            </tr>
        `;
    }
}


// ============================
// ADD / UPDATE
// ============================

form.addEventListener("submit", async event => {

    event.preventDefault();


    const itemName =
        document.getElementById("item-name").value;

    const unit =
        document.getElementById("unit").value;

    const quantity =
        document.getElementById("quantity").value;

    const reorderLevel =
        document.getElementById(
            "reorder-level"
        ).value;

    const unitCost =
        document.getElementById(
            "unit-cost"
        ).value;

    const supplierId =
        document.getElementById(
            "supplier-id"
        ).value;


    formMessage.textContent =
        "Saving...";


    try {

        const url = editingId
            ? `${API_URL}/inventory/${editingId}`
            : `${API_URL}/inventory`;

        const method = editingId
            ? "PUT"
            : "POST";


        const response =
            await fetch(url, {

                method: method,

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${token}`
                },

                body: JSON.stringify({

                    item_name: itemName,

                    unit: unit,

                    quantity_in_stock:
                        Number(quantity),

                    reorder_level:
                        Number(reorderLevel),

                    unit_cost:
                        Number(unitCost),

                    supplier_id:
                        Number(supplierId)
                })
            });


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to save inventory item"
            );
        }


        formMessage.textContent =
            editingId
                ? "Inventory item updated successfully!"
                : "Inventory item created successfully!";


        form.reset();

        editingId = null;


        document.getElementById(
            "form-title"
        ).textContent =
            "Add Inventory Item";


        await loadInventory();

    } catch (error) {

        console.error(error);

        formMessage.textContent =
            error.message;
    }
});


// ============================
// EDIT
// ============================

async function editInventoryItem(id) {

    try {

        const response =
            await fetch(
                `${API_URL}/inventory/${id}`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load inventory item"
            );
        }


        editingId = id;


        document.getElementById(
            "item-name"
        ).value =
            data.item_name || "";


        document.getElementById(
            "unit"
        ).value =
            data.unit || "";


        document.getElementById(
            "quantity"
        ).value =
            data.quantity_in_stock || "";


        document.getElementById(
            "reorder-level"
        ).value =
            data.reorder_level || "";


        document.getElementById(
            "unit-cost"
        ).value =
            data.unit_cost || "";


        document.getElementById(
            "supplier-id"
        ).value =
            String(data.supplier_id);


        document.getElementById(
            "form-title"
        ).textContent =
            "Edit Inventory Item";


        formMessage.textContent = "";

        formSection.style.display =
            "block";


        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error(error);

        alert(
            "Edit error: " +
            error.message
        );
    }
}


// ============================
// DELETE
// ============================

async function deleteInventoryItem(id) {

    if (!confirm(
        "Are you sure you want to delete this inventory item?"
    )) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/inventory/${id}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to delete inventory item"
            );
        }


        alert(
            "Inventory item deleted successfully"
        );


        await loadInventory();

    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


// ============================
// START
// ============================

loadSuppliers();

loadInventory();
