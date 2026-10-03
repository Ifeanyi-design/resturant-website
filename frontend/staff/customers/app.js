// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const customersTable = document.getElementById('customers-table');

async function loadCustomers() {
    try {
        const response = await fetch(`${API_URL}/customers`);

        if (!response.ok) {
            throw new Error('Failed to load customers');
        }

        const customers = await response.json();

        customersTable.innerHTML = '';

        if (customers.length === 0) {
            customersTable.innerHTML = `
                <tr>
                    <td colspan="5">No customers found.</td>
                </tr>
            `;
            return;
        }

        customers.forEach(customer => {
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${customer.customer_id}</td>
                <td>${customer.first_name}</td>
                <td>${customer.last_name}</td>
                <td>${customer.phone || '-'}</td>
                <td>${customer.email || '-'}</td>
            `;

            customersTable.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        customersTable.innerHTML = `
            <tr>
                <td colspan="5">
                    Failed to load customers.
                </td>
            </tr>
        `;
    }
}

loadCustomers();
