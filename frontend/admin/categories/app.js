// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}

const tableBody = document.getElementById("category-table-body");
const formSection = document.getElementById("category-form-section");
const addButton = document.getElementById("add-category-btn");
const cancelButton = document.getElementById("cancel-btn");
const categoryForm = document.getElementById("category-form");
const formMessage = document.getElementById("form-message");

let editingId = null;


// ADD CATEGORY
addButton.addEventListener("click", () => {

    editingId = null;

    document.querySelector("#category-form-section h2").textContent =
        "Add Category";

    categoryForm.reset();

    formMessage.textContent = "";

    formSection.style.display = "block";

    formSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


// CANCEL
cancelButton.addEventListener("click", () => {
    formSection.style.display = "none";
    editingId = null;
});


// LOAD CATEGORIES
async function loadCategories() {

    try {

        const response = await fetch(`${API_URL}/categories`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load categories");
        }

        const categories = await response.json();

        tableBody.innerHTML = "";

        categories.forEach(category => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${category.category_id}</td>

                <td>${category.category_name}</td>

                <td>${category.description || "-"}</td>

                <td>
                    <button class="action-btn edit-btn">
    Edit
</button>

<button class="action-btn delete-btn">
    Delete
</button>
                </td>
            `;

            const editButton =
                row.querySelector(".edit-btn");

            const deleteButton =
                row.querySelector(".delete-btn");

            editButton.addEventListener("click", () => {
                editCategory(category.category_id);
            });

            deleteButton.addEventListener("click", () => {
                deleteCategory(category.category_id);
            });

            tableBody.appendChild(row);
        });

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    Failed to load categories.
                </td>
            </tr>
        `;
    }
}


// EDIT CATEGORY
async function editCategory(id) {

    try {

        const response =
            await fetch(`${API_URL}/categories/${id}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to load category"
            );
        }

        editingId = id;

        document.querySelector("#category-form-section h2").textContent =
            "Edit Category";

        document.getElementById("category-name").value =
            data.category_name || "";

        document.getElementById("description").value =
            data.description || "";

        formMessage.textContent = "";

        formSection.style.display = "block";

        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error(error);

        alert("Edit error: " + error.message);
    }
}


// SAVE CATEGORY
categoryForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const categoryName =
        document.getElementById("category-name").value;

    const description =
        document.getElementById("description").value;

    formMessage.textContent = "Saving...";

    try {

        const url = editingId
            ? `${API_URL}/categories/${editingId}`
            : `${API_URL}/categories`;

        const method = editingId
            ? "PUT"
            : "POST";

        const response = await fetch(url, {

            method: method,

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                category_name: categoryName,
                description: description || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to save category"
            );
        }

        formMessage.textContent =
            editingId
                ? "Category updated successfully!"
                : "Category created successfully!";

        categoryForm.reset();

        editingId = null;

        document.querySelector("#category-form-section h2").textContent =
            "Add Category";

        await loadCategories();

    } catch (error) {

        console.error(error);

        formMessage.textContent =
            error.message;
    }
});


// DELETE CATEGORY
async function deleteCategory(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this category?"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(`${API_URL}/categories/${id}`, {
                method: "DELETE",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to delete category"
            );
        }

        alert("Category deleted successfully");

        await loadCategories();

    } catch (error) {

        console.error(error);

        alert("Delete error: " + error.message);
    }
}


loadCategories();
