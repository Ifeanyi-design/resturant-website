// ============================================================================
//  Recipe mapping  —  PRD FR8
// ============================================================================
//  Lets an administrator say which inventory items (and how much of each) one
//  unit of a menu item consumes. This is what drives automatic stock deduction
//  when an order is completed.
//
//  Without this screen the mapping could only be created by hand in SQL, and a
//  menu item with no mapping cannot be ordered at all.
//
//  The save is a full replace: the API takes the complete list, so what you see
//  on screen is exactly what ends up in the database.
// ============================================================================

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}

const messageBox = document.getElementById("message");
const itemSelect = document.getElementById("item-select");
const itemStatus = document.getElementById("item-status");

const recipePanel = document.getElementById("recipe-panel");
const recipeHeading = document.getElementById("recipe-heading");
const rowsBody = document.getElementById("rows-body");
const stockNote = document.getElementById("stock-note");

const addRowBtn = document.getElementById("add-row-btn");
const saveBtn = document.getElementById("save-btn");
const revertBtn = document.getElementById("revert-btn");

let menuItems = [];
let inventoryItems = [];
let currentItemId = null;


// ========================================
// HELPERS
// ========================================

function showMessage(text, kind) {
    messageBox.className = kind === "error" ? "error" : "message";
    messageBox.textContent = text;
}

function clearMessage() {
    messageBox.className = "";
    messageBox.textContent = "";
}

function inventoryById(id) {
    return inventoryItems.find(item => Number(item.inventory_id) === Number(id));
}


// ========================================
// ROWS
// ========================================

function buildInventoryOptions(selectedId) {
    return inventoryItems
        .map(item => `
            <option value="${item.inventory_id}"
                ${Number(item.inventory_id) === Number(selectedId) ? "selected" : ""}>
                ${item.item_name}
            </option>
        `)
        .join("");
}

function updateRowUnit(row) {
    const select = row.querySelector("select");
    const unitCell = row.querySelector(".unit-cell");
    const inventoryItem = inventoryById(select.value);

    unitCell.textContent = inventoryItem ? inventoryItem.unit : "—";
}

function addRow(inventoryId, quantity) {
    const row = document.createElement("tr");

    row.innerHTML = `
        <td>
            <select class="ingredient-select">
                <option value="">Select an item</option>
                ${buildInventoryOptions(inventoryId)}
            </select>
        </td>

        <td>
            <input
                type="number"
                class="quantity-input"
                min="0.001"
                step="0.001"
                placeholder="e.g. 0.25"
                value="${quantity !== undefined ? quantity : ""}"
            >
        </td>

        <td class="unit-cell">—</td>

        <td>
            <button type="button" class="delete-btn btn-sm remove-row-btn">
                Remove
            </button>
        </td>
    `;

    rowsBody.appendChild(row);

    row.querySelector("select").addEventListener("change", () => updateRowUnit(row));

    row.querySelector(".remove-row-btn").addEventListener("click", () => {
        row.remove();
        refreshEmptyState();
    });

    updateRowUnit(row);
}

function refreshEmptyState() {
    if (rowsBody.children.length === 0) {
        rowsBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4" class="muted">
                    No ingredients mapped. This item cannot be ordered until at
                    least one ingredient is added.
                </td>
            </tr>
        `;
        return;
    }

    // Drop the placeholder if real rows exist.
    const placeholder = rowsBody.querySelector(".empty-row");
    if (placeholder) {
        placeholder.remove();
    }
}

function collectRows() {
    const rows = [];
    const seen = new Set();

    for (const row of rowsBody.querySelectorAll("tr")) {
        if (row.classList.contains("empty-row")) {
            continue;
        }

        const inventoryId = row.querySelector("select").value;
        const quantity = row.querySelector(".quantity-input").value;

        if (!inventoryId) {
            return { error: "Choose an inventory item for every row." };
        }

        if (!quantity || Number(quantity) <= 0) {
            return { error: "Every ingredient needs a quantity greater than zero." };
        }

        if (seen.has(inventoryId)) {
            return { error: "The same inventory item is listed more than once." };
        }

        seen.add(inventoryId);

        rows.push({
            inventory_id: Number(inventoryId),
            quantity_required: Number(quantity)
        });
    }

    return { rows };
}


// ========================================
// LOAD
// ========================================

async function loadRecipe(itemId) {
    if (!itemId) {
        recipePanel.hidden = true;
        itemStatus.textContent = "";
        return;
    }

    try {
        const data = await window.api.get(`/api/menu/${itemId}/ingredients`);

        currentItemId = itemId;

        recipePanel.hidden = false;
        recipeHeading.textContent = `Ingredients for ${data.item_name}`;

        rowsBody.innerHTML = "";

        if (data.ingredients.length === 0) {
            refreshEmptyState();
        } else {
            data.ingredients.forEach(line =>
                addRow(line.inventory_id, Number(line.quantity_required))
            );
        }

        updateStockNote();

        itemStatus.textContent = data.ingredients.length === 0
            ? "This item has no recipe yet and cannot be ordered."
            : `${data.ingredients.length} ingredient(s) mapped.`;

    } catch (error) {
        console.error(error);
        showMessage(error.message || "Failed to load the recipe.", "error");
    }
}

function updateStockNote() {
    const rows = collectRows();

    if (rows.error) {
        stockNote.textContent = "";
        return;
    }

    // Show the current stock for each mapped ingredient, so it is obvious when
    // a recipe refers to something that is nearly out.
    const parts = rows.rows.map(line => {
        const item = inventoryById(line.inventory_id);
        if (!item) {
            return null;
        }
        const per = Number(line.quantity_required);
        const stock = Number(item.quantity_in_stock);
        const possible = per > 0 ? Math.floor(stock / per) : 0;

        return `${item.item_name}: ${stock} ${item.unit} in stock — enough for ${possible} serving(s)`;
    }).filter(Boolean);

    stockNote.textContent = parts.join(" · ");
}


async function loadReferenceData() {
    try {
        const [menu, inventory] = await Promise.all([
            window.api.get("/api/menu"),
            window.api.get("/api/inventory")
        ]);

        menuItems = menu;
        inventoryItems = inventory;

        itemSelect.innerHTML =
            `<option value="">Select a menu item&hellip;</option>` +
            menuItems
                .map(item => `
                    <option value="${item.item_id}">
                        ${item.item_name}${Number(item.availability) === 1 ? "" : " (unavailable)"}
                    </option>
                `)
                .join("");

    } catch (error) {
        console.error(error);
        itemSelect.innerHTML = `<option value="">Failed to load</option>`;
        showMessage(error.message || "Failed to load menu and inventory.", "error");
    }
}


// ========================================
// EVENTS
// ========================================

itemSelect.addEventListener("change", () => {
    clearMessage();
    loadRecipe(itemSelect.value);
});

addRowBtn.addEventListener("click", () => {
    const placeholder = rowsBody.querySelector(".empty-row");
    if (placeholder) {
        placeholder.remove();
    }
    addRow();
});

revertBtn.addEventListener("click", () => {
    clearMessage();
    loadRecipe(currentItemId);
});

saveBtn.addEventListener("click", async () => {
    if (!currentItemId) {
        showMessage("Choose a menu item first.", "error");
        return;
    }

    const collected = collectRows();

    if (collected.error) {
        showMessage(collected.error, "error");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const result = await window.api.put(
            `/api/menu/${currentItemId}/ingredients`,
            { ingredients: collected.rows }
        );

        showMessage(
            result.message || "Recipe saved.",
            "success"
        );

        await loadRecipe(currentItemId);

    } catch (error) {
        console.error(error);
        showMessage(error.message || "Failed to save the recipe.", "error");

    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save recipe";
    }
});


// ========================================
// START
// ========================================

loadReferenceData();
