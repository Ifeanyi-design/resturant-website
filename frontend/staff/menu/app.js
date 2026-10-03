// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const menuTable = document.getElementById('menu-table');

async function loadMenu() {
    try {
        const response = await fetch(`${API_URL}/menu`);

        if (!response.ok) {
            throw new Error('Failed to load menu');
        }

        const menu = await response.json();

        menuTable.innerHTML = '';

        if (menu.length === 0) {
            menuTable.innerHTML = `
                <tr>
                    <td colspan="6">No menu items found.</td>
                </tr>
            `;
            return;
        }

        menu.forEach(item => {
            const row = document.createElement('tr');

            const availability = Number(item.availability) === 1;

            row.innerHTML = `
                <td>${item.item_id}</td>
                <td>${item.item_name}</td>
                <td>${item.category_name || '-'}</td>
                <td>₦${Number(item.price).toLocaleString()}</td>
                <td>${item.description || '-'}</td>
                <td>
                    <span class="${availability ? 'available' : 'unavailable'}">
                        ${availability ? 'Available' : 'Unavailable'}
                    </span>
                </td>
            `;

            menuTable.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        menuTable.innerHTML = `
            <tr>
                <td colspan="6">
                    Failed to load menu.
                </td>
            </tr>
        `;
    }
}

loadMenu();
