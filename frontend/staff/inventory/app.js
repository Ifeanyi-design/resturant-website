// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const inventoryTable = document.getElementById('inventory-table');

async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/inventory`);

        if (!response.ok) {
            throw new Error('Failed to load inventory');
        }

        const inventory = await response.json();

        inventoryTable.innerHTML = '';

        if (inventory.length === 0) {
            inventoryTable.innerHTML = `
                <tr>
                    <td colspan="8">No inventory items found.</td>
                </tr>
            `;
            return;
        }

        inventory.forEach(item => {
            const row = document.createElement('tr');

            const quantity = Number(item.quantity_in_stock);
            const reorderLevel = Number(item.reorder_level);

            const isLowStock = quantity <= reorderLevel;

            row.innerHTML = `
                <td>${item.inventory_id}</td>

                <td>${item.item_name}</td>

                <td>${item.unit}</td>

                <td>${quantity}</td>

                <td>${reorderLevel}</td>

                <td>
                    ₦${Number(item.unit_cost).toLocaleString()}
                </td>

                <td>
                    ${item.supplier_name || '-'}
                </td>

                <td>
                    <span class="status ${isLowStock ? 'low' : 'normal'}">
                        ${isLowStock ? 'Low Stock' : 'Normal'}
                    </span>
                </td>
            `;

            inventoryTable.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        inventoryTable.innerHTML = `
            <tr>
                <td colspan="8">
                    Failed to load inventory.
                </td>
            </tr>
        `;
    }
}

loadInventory();
