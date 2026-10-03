// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}

const tableBody = document.getElementById("menu-table-body");
const formSection = document.getElementById("menu-form-section");
const addButton = document.getElementById("add-menu-btn");
const cancelButton = document.getElementById("cancel-btn");
const menuForm = document.getElementById("menu-form");
const formMessage = document.getElementById("form-message");

let editingId = null;

addButton.addEventListener("click", () => {
    editingId = null;

    document.querySelector("#menu-form-section h2").textContent =
        "Add Menu Item";

    menuForm.reset();

    document.getElementById("availability").checked = true;

    formSection.style.display = "block";

    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

cancelButton.addEventListener("click", () => {
    formSection.style.display = "none";
    editingId = null;
});

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);

        const categories = await response.json();

        const categorySelect =
            document.getElementById("category-id");

        categorySelect.innerHTML =
            '<option value="">Select category</option>';

        categories.forEach(category => {
            const option = document.createElement("option");

            option.value = category.category_id;
            option.textContent = category.category_name;

            categorySelect.appendChild(option);
        });

    } catch (error) {
        console.error("Category loading error:", error);
    }
}

async function loadMenu() {
    try {
        const response = await fetch(`${API_URL}/menu`);

        if (!response.ok) {
            throw new Error("Failed to load menu");
        }

        const menuItems = await response.json();

        tableBody.innerHTML = "";

        menuItems.forEach(item => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${item.item_id}</td>
                <td>${item.item_name}</td>
                <td>${item.category_name}</td>
                <td>₦${Number(item.price).toLocaleString()}</td>
                <td>
                    ${item.availability ? "Available" : "Unavailable"}
                </td>
                <td>
                    <button class="edit-btn">
                        Edit
                    </button>

                    <button class="delete-btn">
                        Delete
                    </button>
                </td>
            `;

            const editButton = row.querySelector(".edit-btn");
            const deleteButton = row.querySelector(".delete-btn");

            editButton.addEventListener("click", () => {
                editMenuItem(item.item_id);
            });

            deleteButton.addEventListener("click", () => {
                deleteMenuItem(item.item_id);
            });

            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Load menu error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load menu items.
                </td>
            </tr>
        `;
    }
}

menuForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const itemName =
        document.getElementById("item-name").value;

    const categoryId =
        document.getElementById("category-id").value;

    const price =
        document.getElementById("price").value;

    const description =
        document.getElementById("description").value;

    const availability =
        document.getElementById("availability").checked;

    formMessage.textContent = "Saving...";

    try {
        const url = editingId
            ? `${API_URL}/menu/${editingId}`
            : `${API_URL}/menu`;

        const method = editingId ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                item_name: itemName,
                category_id: Number(categoryId),
                price: Number(price),
                description: description || null,
                availability: availability ? 1 : 0
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to save menu item"
            );
        }

        formMessage.textContent =
            editingId
                ? "Menu item updated successfully!"
                : "Menu item created successfully!";

        menuForm.reset();

        document.getElementById("availability").checked = true;

        editingId = null;

        document.querySelector("#menu-form-section h2").textContent =
            "Add Menu Item";

        await loadMenu();

    } catch (error) {
        console.error(error);
        formMessage.textContent = error.message;
    }
});

async function editMenuItem(id) {
    try {
        const response = await fetch(`${API_URL}/menu/${id}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(
                data.error || "Failed to load menu item"
            );
        }

        editingId = id;

        document.querySelector("#menu-form-section h2").textContent =
            "Edit Menu Item";

        document.getElementById("item-name").value =
            data.item_name;

        document.getElementById("category-id").value =
            data.category_id;

        document.getElementById("price").value =
            data.price;

        document.getElementById("description").value =
            data.description || "";

        document.getElementById("availability").checked =
            Boolean(data.availability);

        formMessage.textContent = "";

        formSection.style.display = "block";
        
        formSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
});

    } catch (error) {
        console.error("Edit error:", error);
        alert(error.message);
    }
}

async function deleteMenuItem(id) {
    if (!confirm("Are you sure you want to delete this menu item?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/menu/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to delete menu item"
            );
        }

        alert("Menu item deleted successfully");

        await loadMenu();

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

loadCategories();
loadMenu();
