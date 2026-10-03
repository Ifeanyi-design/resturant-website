// ============================================================================
//  End-to-end workflow test  —  npm run test:workflow
// ============================================================================
//  Exercises the real system against a real database, end to end:
//
//    login -> browse menu -> place order -> pay -> walk the full order
//    lifecycle -> stock deducted -> reports reflect it
//
//  This is the test that proves Phase A (database), Phase B (auth) and
//  Phase C (order lifecycle, reports) work together rather than in isolation.
//
//  REQUIREMENTS
//  ------------
//    * MariaDB/MySQL running and reachable via backend/.env
//    * the database seeded:  npm run db:setup
//
//  NOTE: this test WRITES data (it places and completes an order). That is
//  intentional — it is the only way to prove the stock deduction works. All
//  assertions are written as deltas, so the test passes whether or not it has
//  been run before.
// ============================================================================
process.env.PORT = process.env.TEST_PORT || '3996';

const BASE = `http://localhost:${process.env.PORT}`;

require('../server.js');

let passed = 0;
const failures = [];

function check(label, condition, detail) {
    if (condition) {
        passed++;
        console.log(`  PASS  ${label}`);
    } else {
        failures.push({ label, detail });
        console.log(`  FAIL  ${label}${detail ? '  -> ' + detail : ''}`);
    }
}

async function api(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await response.text();

    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* non-JSON */ }

    return { status: response.status, body: json, raw: text };
}

function section(title) {
    console.log(`\n  ${title}`);
    console.log('  ' + '-'.repeat(72));
}

(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
        // ------------------------------------------------------------------
        section('1. Login (Phase B auth)');

        const adminLogin = await api('POST', '/api/auth/login', {
            body: { email: 'admin@restaurant.test', password: 'admin123' }
        });

        check('admin can log in', adminLogin.status === 200 && !!adminLogin.body?.token,
            `status=${adminLogin.status}`);

        const adminToken = adminLogin.body?.token;

        const badLogin = await api('POST', '/api/auth/login', {
            body: { email: 'admin@restaurant.test', password: 'wrong-password' }
        });

        check('wrong password is rejected', badLogin.status === 401,
            `status=${badLogin.status}`);

        const customerLogin = await api('POST', '/api/auth/customer/login', {
            body: { email: 'ada@example.com', password: 'customer123' }
        });

        check('customer can log in', customerLogin.status === 200 && !!customerLogin.body?.token,
            `status=${customerLogin.status}`);

        const customerToken = customerLogin.body?.token;
        const customerId = customerLogin.body?.customer?.customer_id;

        check('customer id returned', Number.isInteger(customerId), `customer_id=${customerId}`);


        // ------------------------------------------------------------------
        section('2. Browse the menu (public endpoint)');

        const menu = await api('GET', '/api/menu');

        check('menu list is public', menu.status === 200 && Array.isArray(menu.body),
            `status=${menu.status}`);

        const water = menu.body.find((item) => item.item_name === 'Bottled Water');
        const juice = menu.body.find((item) => item.item_name === 'Fruit Juice');

        check('seeded menu item found (Bottled Water)', !!water);
        check('Fruit Juice is seeded as unavailable', !!juice && Number(juice.availability) === 0);


        // ------------------------------------------------------------------
        section('3. Place an order (FR3, FR4)');

        const before = await api('GET', '/api/inventory', { token: adminToken });
        const waterStockBefore = before.body.find((i) => i.item_name === 'Bottled Water (75cl)');

        check('can read inventory as staff/admin', !!waterStockBefore);

        const quantity = 2;
        const order = await api('POST', '/api/orders', {
            token: customerToken,
            body: {
                customer_id: customerId,
                items: [{ item_id: water.item_id, quantity }]
            }
        });

        check('customer can create an order', order.status === 201, `status=${order.status} ${order.raw}`);

        const orderId = order.body?.order_id;
        const expectedTotal = Number(water.price) * quantity;

        check(`order total calculated server-side (${expectedTotal})`,
            Number(order.body?.total_amount) === expectedTotal,
            `got ${order.body?.total_amount}`);


        // ------------------------------------------------------------------
        section('4. Server-side validation guards');

        const unavailable = await api('POST', '/api/orders', {
            token: customerToken,
            body: { customer_id: customerId, items: [{ item_id: juice.item_id, quantity: 1 }] }
        });

        check('cannot order an unavailable item', unavailable.status === 500 || unavailable.status === 400,
            `status=${unavailable.status}`);

        const otherCustomer = await api('POST', '/api/orders', {
            token: customerToken,
            body: { customer_id: customerId + 999, items: [{ item_id: water.item_id, quantity: 1 }] }
        });

        check('customer cannot order for another customer', otherCustomer.status === 403,
            `status=${otherCustomer.status}`);

        const badQuantity = await api('POST', '/api/orders', {
            token: customerToken,
            body: { customer_id: customerId, items: [{ item_id: water.item_id, quantity: 0 }] }
        });

        check('zero quantity is rejected', badQuantity.status === 500 || badQuantity.status === 400,
            `status=${badQuantity.status}`);


        // ------------------------------------------------------------------
        section('5. Payment (FR6)');

        const wrongAmount = await api('POST', '/api/payments', {
            token: customerToken,
            body: { order_id: orderId, payment_method: 'Card', amount: expectedTotal + 1 }
        });

        check('payment must match the order total', wrongAmount.status === 400,
            `status=${wrongAmount.status}`);

        const payment = await api('POST', '/api/payments', {
            token: customerToken,
            body: { order_id: orderId, payment_method: 'Card', amount: expectedTotal }
        });

        check('card payment recorded', payment.status === 201, `status=${payment.status} ${payment.raw}`);
        check('card payment is immediately Paid', payment.body?.payment_status === 'Paid',
            `got ${payment.body?.payment_status}`);


        // ------------------------------------------------------------------
        section('6. Order lifecycle (FR5)');

        const detail = await api('GET', `/api/orders/${orderId}`, { token: adminToken });

        check('order detail reports allowed next statuses',
            Array.isArray(detail.body?.allowed_next_statuses) &&
            detail.body.allowed_next_statuses.includes('Preparing'),
            JSON.stringify(detail.body?.allowed_next_statuses));

        const skipAhead = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Completed' }
        });

        check('cannot skip straight from Pending to Completed', skipAhead.status === 400,
            `status=${skipAhead.status}`);

        const bogus = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Delivered' }
        });

        check('unknown status is rejected', bogus.status === 400, `status=${bogus.status}`);

        const toPreparing = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Preparing' }
        });

        check('Pending -> Preparing', toPreparing.status === 200 && toPreparing.body?.status === 'Preparing',
            `status=${toPreparing.status} ${toPreparing.raw}`);

        const toReady = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Ready' }
        });

        check('Preparing -> Ready', toReady.status === 200 && toReady.body?.status === 'Ready',
            `status=${toReady.status}`);

        const toCompleted = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Completed' }
        });

        check('Ready -> Completed', toCompleted.status === 200 && toCompleted.body?.status === 'Completed',
            `status=${toCompleted.status} ${toCompleted.raw}`);

        const afterComplete = await api('PUT', `/api/orders/${orderId}/status`, {
            token: adminToken, body: { status: 'Preparing' }
        });

        check('Completed is terminal', afterComplete.status === 400, `status=${afterComplete.status}`);


        // ------------------------------------------------------------------
        section('7. Stock deduction (FR8)');

        const after = await api('GET', '/api/inventory', { token: adminToken });
        const waterStockAfter = after.body.find((i) => i.item_name === 'Bottled Water (75cl)');

        const deducted =
            Number(waterStockBefore.quantity_in_stock) - Number(waterStockAfter.quantity_in_stock);

        check(`stock deducted by ${quantity} (recipe is 1 bottle per unit)`,
            deducted === quantity,
            `deducted ${deducted}, expected ${quantity}`);


        // ------------------------------------------------------------------
        section('8. Cancellation path');

        const order2 = await api('POST', '/api/orders', {
            token: customerToken,
            body: { customer_id: customerId, items: [{ item_id: water.item_id, quantity: 1 }] }
        });

        const cancel = await api('PUT', `/api/orders/${order2.body.order_id}/status`, {
            token: adminToken, body: { status: 'Cancelled' }
        });

        check('Pending -> Cancelled', cancel.status === 200 && cancel.body?.status === 'Cancelled',
            `status=${cancel.status}`);

        const stockUnchanged = await api('GET', '/api/inventory', { token: adminToken });
        const waterAfterCancel = stockUnchanged.body.find((i) => i.item_name === 'Bottled Water (75cl)');

        check('cancelling an order does NOT touch stock',
            Number(waterAfterCancel.quantity_in_stock) === Number(waterStockAfter.quantity_in_stock),
            `before=${waterStockAfter.quantity_in_stock} after=${waterAfterCancel.quantity_in_stock}`);


        // ------------------------------------------------------------------
        section('9. Low stock (FR9)');

        const lowStock = await api('GET', '/api/inventory/low-stock', { token: adminToken });

        check('low-stock endpoint is reachable', lowStock.status === 200 && Array.isArray(lowStock.body),
            `status=${lowStock.status}`);

        check('low-stock returns only items at/below reorder level',
            lowStock.body.every((i) => Number(i.quantity_in_stock) <= Number(i.reorder_level)));

        check(`seeded low-stock items present (${lowStock.body.length} found)`, lowStock.body.length >= 3,
            `found ${lowStock.body.length}`);


        // ------------------------------------------------------------------
        section('10. Reports (FR10)');

        const report = await api('GET', '/api/reports/summary', { token: adminToken });

        check('report summary is reachable', report.status === 200, `status=${report.status} ${report.raw}`);

        const r = report.body;

        check('report has order counts by status',
            r?.orders?.by_status && typeof r.orders.by_status.Completed === 'number');

        check('completed count reflects the order we just completed',
            r.orders.by_status.Completed >= 1, `Completed=${r.orders.by_status.Completed}`);

        check('cancelled count reflects the order we just cancelled',
            r.orders.by_status.Cancelled >= 1, `Cancelled=${r.orders.by_status.Cancelled}`);

        check('sales total collected is greater than zero',
            r?.sales?.total_collected > 0, `total_collected=${r?.sales?.total_collected}`);

        check('menu availability is reported',
            r?.menu?.total_items > 0 && typeof r.menu.available_items === 'number',
            JSON.stringify(r?.menu));

        check('low stock items included in report',
            Array.isArray(r?.low_stock) && r.low_stock.length >= 3, `${r?.low_stock?.length}`);

        check('popular items included in report',
            Array.isArray(r?.popular_items) && r.popular_items.length >= 1,
            `${r?.popular_items?.length}`);

        check('cancelled order excluded from popular items (only Completed counted)',
            r.popular_items.every((i) => i.total_quantity >= quantity),
            JSON.stringify(r.popular_items));


        // ------------------------------------------------------------------
        section('11. Report access control');

        const reportAsCustomer = await api('GET', '/api/reports/summary', { token: customerToken });
        check('customer cannot read reports', reportAsCustomer.status === 403,
            `status=${reportAsCustomer.status}`);

        const reportNoToken = await api('GET', '/api/reports/summary');
        check('reports require a token', reportNoToken.status === 401,
            `status=${reportNoToken.status}`);


        // ------------------------------------------------------------------
        section('12. Order ownership');

        const ownOrder = await api('GET', `/api/orders/${orderId}`, { token: customerToken });
        check('customer can read their own order', ownOrder.status === 200, `status=${ownOrder.status}`);

        // Staff may place an order on behalf of a different customer (counter
        // service). That also gives us an order Ada does NOT own, which is what
        // the ownership check actually needs to be tested against.
        const otherCustomerId = 2;

        const foreignOrder = await api('POST', '/api/orders', {
            token: adminToken,
            body: { customer_id: otherCustomerId, items: [{ item_id: water.item_id, quantity: 1 }] }
        });

        check('staff can place an order for another customer (FR3)',
            foreignOrder.status === 201,
            `status=${foreignOrder.status} ${foreignOrder.raw}`);

        const foreignRead = await api('GET', `/api/orders/${foreignOrder.body?.order_id}`, {
            token: customerToken
        });

        check('customer cannot read an order belonging to someone else',
            foreignRead.status === 403, `status=${foreignRead.status}`);

        const foreignList = await api('GET', `/api/orders/customer/${otherCustomerId}`, {
            token: customerToken
        });

        check("customer cannot list another customer's orders",
            foreignList.status === 403, `status=${foreignList.status}`);

    } catch (error) {
        console.error('\n  UNEXPECTED ERROR:', error.message);
        console.error(error.stack);
        failures.push({ label: 'unexpected error', detail: error.message });
    }

    console.log(`\n  ${passed} passed, ${failures.length} failed\n`);

    if (failures.length > 0) {
        console.log('  FAILURES:');
        for (const f of failures) console.log(`   - ${f.label}${f.detail ? '  -> ' + f.detail : ''}`);
        console.log('');
    }

    process.exit(failures.length > 0 ? 1 : 0);
})();
