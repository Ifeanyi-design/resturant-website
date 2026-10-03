// Base comes from js/api.js, which resolves it for the current host
// (same-origin in production). Never hardcode a hostname here.
const API_URL = window.api.base;

const paymentsTable = document.getElementById('payments-table');

async function loadPayments() {
    try {
        const response = await fetch(`${API_URL}/payments`);

        if (!response.ok) {
            throw new Error('Failed to load payments');
        }

        const payments = await response.json();

        paymentsTable.innerHTML = '';

        if (payments.length === 0) {
            paymentsTable.innerHTML = `
                <tr>
                    <td colspan="7">No payments found.</td>
                </tr>
            `;
            return;
        }

        payments.forEach(payment => {
            const row = document.createElement('tr');

            const status = (payment.payment_status || 'Pending').toLowerCase();

            let statusClass = 'pending';

            if (status === 'paid') {
                statusClass = 'paid';
            } else if (status === 'failed') {
                statusClass = 'failed';
            }

            row.innerHTML = `
                <td>${payment.payment_id}</td>
                <td>${payment.order_id}</td>
                <td>${payment.customer_name || '-'}</td>
                <td>${payment.payment_method || '-'}</td>
                <td>₦${Number(payment.amount).toLocaleString()}</td>
                <td>
                    <span class="status ${statusClass}">
                        ${payment.payment_status || 'Pending'}
                    </span>
                </td>
                <td>
                    ${payment.payment_date
                        ? new Date(payment.payment_date).toLocaleString()
                        : '-'}
                </td>
            `;

            paymentsTable.appendChild(row);
        });

    } catch (error) {
        console.error(error);

        paymentsTable.innerHTML = `
            <tr>
                <td colspan="7">
                    Failed to load payments.
                </td>
            </tr>
        `;
    }
}

loadPayments();
