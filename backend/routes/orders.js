const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// The order lifecycle rules live in domain/orderLifecycle.js so that this file
// and routes/reports.js cannot disagree about what a valid status is.
const { ORDER_STATUSES, ALLOWED_TRANSITIONS } = require('../domain/orderLifecycle');


// ============================================================================
//  POST /api/orders/track  —  PUBLIC (no login)
// ============================================================================
//  Lets someone follow an order without an account - useful for a walk-in
//  customer, or anyone who ordered at the counter.
//
//  Body: { "order_id": 12, "contact": "08031234567" | "ada@example.com" }
//
//  WHY A CONTACT IS REQUIRED
//  Order ids are sequential integers, so an endpoint keyed on the id alone
//  would let anyone read any order by counting upwards - including other
//  customers' names and totals. The phone/email on the order acts as a shared
//  secret that only the person who placed it knows.
//
//  A wrong contact and a non-existent order return the SAME 404 message, so the
//  endpoint cannot be used to discover which order numbers exist.
//
//  Declared before the /:id routes on purpose: a single-segment static path
//  must never sit below a parameterised one.
// ============================================================================
router.post('/track', async (req, res) => {
    let connection;

    try {
        const { order_id, contact } = req.body;

        if (!order_id || !contact) {
            return res.status(400).json({
                error: 'Order number and the phone or email on the order are required'
            });
        }

        const orderId = Number(order_id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'Enter a valid order number'
            });
        }

        const needle = String(contact).trim().toLowerCase();

        if (needle.length < 4) {
            return res.status(400).json({
                error: 'Enter the phone number or email used on the order'
            });
        }

        connection = await pool.getConnection();

        const rows = await connection.query(
            `SELECT
                o.order_id,
                o.order_date,
                o.status,
                o.total_amount,
                c.first_name,
                c.phone,
                c.email,
                (
                    SELECT p.payment_status
                    FROM payments p
                    WHERE p.order_id = o.order_id
                    ORDER BY p.payment_id DESC
                    LIMIT 1
                ) AS payment_status
             FROM orders o
             JOIN customers c
                ON o.customer_id = c.customer_id
             WHERE o.order_id = ?`,
            [orderId]
        );

        const NOT_FOUND = {
            error: 'No order found with that number and contact details'
        };

        if (rows.length === 0) {
            return res.status(404).json(NOT_FOUND);
        }

        const order = rows[0];

        const phone = String(order.phone || '').toLowerCase();
        const email = String(order.email || '').toLowerCase();

        // Compare digits for phones, so "0803 123 4567" matches "08031234567",
        // and fall back to the last 7 digits so a +234 country prefix also works.
        const digits = needle.replace(/\D/g, '');
        const phoneDigits = phone.replace(/\D/g, '');

        const contactMatches =
            (email.length > 0 && email === needle) ||
            (phone.length > 0 && phone === needle) ||
            (phoneDigits.length >= 7 && digits.length >= 7 &&
                phoneDigits.endsWith(digits.slice(-7)));

        if (!contactMatches) {
            return res.status(404).json(NOT_FOUND);
        }

        const items = await connection.query(
            `SELECT
                mi.item_name,
                oi.quantity,
                oi.unit_price,
                oi.subtotal
             FROM order_items oi
             JOIN menu_items mi
                ON oi.item_id = mi.item_id
             WHERE oi.order_id = ?
             ORDER BY oi.order_item_id`,
            [orderId]
        );

        res.json({
            order: {
                order_id: order.order_id,
                order_date: order.order_date,
                status: order.status,
                total_amount: Number(order.total_amount),
                payment_status: order.payment_status || 'Unpaid',
                // First name only - enough to confirm "yes, this is my order"
                // without echoing a whole customer record to an anonymous caller.
                first_name: order.first_name
            },
            items: items,
            allowed_next_statuses: ALLOWED_TRANSITIONS[order.status] || []
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to look up the order'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// GET all orders
router.get('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const orders = await connection.query(`
            SELECT
                o.order_id,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                o.order_date,
                o.status,
                o.total_amount
            FROM orders o
            JOIN customers c
                ON o.customer_id = c.customer_id
            ORDER BY o.order_id DESC
        `);

        res.json(orders);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch orders'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

// GET orders for one customer
router.get('/customer/:customerId', verifyToken, async (req, res) => {

    let connection;

    try {

        const customerId =
            Number(req.params.customerId);

        if (!Number.isInteger(customerId) || customerId <= 0) {

            return res.status(400).json({
                error: 'Invalid customer ID'
            });

        }

        // Ownership check: a logged-in customer may only read their own order
        // history. Without this, any customer could enumerate other people's
        // orders by changing the id in the URL.
        if (
            req.user.role === 'customer' &&
            Number(req.user.customer_id) !== customerId
        ) {

            return res.status(403).json({
                error: 'You may only view your own orders'
            });

        }

        connection = await pool.getConnection();

        const orders = await connection.query(`
            SELECT
                o.order_id,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                o.order_date,
                o.status,
                o.total_amount,
                (
                    SELECT p.payment_status
                    FROM payments p
                    WHERE p.order_id = o.order_id
                    ORDER BY p.payment_id DESC
                    LIMIT 1
                ) AS payment_status
            FROM orders o
            JOIN customers c
                ON o.customer_id = c.customer_id
            WHERE o.customer_id = ?
            ORDER BY o.order_id DESC
        `, [customerId]);

        res.json(orders);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch customer orders'
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

});

router.post('/', verifyToken, async (req, res) => {
    let connection;

    try {
        const { customer_id, items } = req.body;

        if (!customer_id || !items || items.length === 0) {
            return res.status(400).json({
                error: 'customer_id and items are required'
            });
        }

        // A customer may only order for themselves. Staff and administrators
        // may place an order on behalf of any customer (counter service).
        // Without this, a logged-in customer could post an order against
        // somebody else's customer_id simply by editing the request body.
        if (
            req.user.role === 'customer' &&
            Number(req.user.customer_id) !== Number(customer_id)
        ) {
            return res.status(403).json({
                error: 'You may only create orders for your own account'
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Check that the customer exists
        const customers = await connection.query(
            'SELECT customer_id FROM customers WHERE customer_id = ?',
            [customer_id]
        );

        if (customers.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                error: 'Customer not found'
            });
        }

        // Create the order first
        const orderResult = await connection.query(
            `INSERT INTO orders (customer_id, status, total_amount)
             VALUES (?, 'Pending', 0.00)`,
            [customer_id]
        );

        const orderId = Number(orderResult.insertId);

        let totalAmount = 0;

        // Process each ordered item
        for (const item of items) {

            const menuItems = await connection.query(
                `SELECT item_id, item_name, price, availability
                 FROM menu_items
                 WHERE item_id = ?`,
                [item.item_id]
            );

            if (menuItems.length === 0) {
                throw new Error(`Menu item ${item.item_id} not found`);
            }

            const menuItem = menuItems[0];

            if (!menuItem.availability) {
                throw new Error(`${menuItem.item_name} is currently unavailable`);
            }

            const quantity = Number(item.quantity);

            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error(
                    `Invalid quantity for ${menuItem.item_name}`
                );
            }

            const unitPrice = Number(menuItem.price);
            const subtotal = unitPrice * quantity;

            await connection.query(
                `INSERT INTO order_items
                 (order_id, item_id, quantity, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    orderId,
                    menuItem.item_id,
                    quantity,
                    unitPrice,
                    subtotal
                ]
            );

            totalAmount += subtotal;
        }

        // Update the order total
        await connection.query(
            `UPDATE orders
             SET total_amount = ?
             WHERE order_id = ?`,
            [totalAmount, orderId]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Order created successfully',
            order_id: orderId,
            customer_id: customer_id,
            total_amount: totalAmount
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    let connection;

    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'Invalid order ID'
            });
        }

        connection = await pool.getConnection();

        const orders = await connection.query(
            `SELECT
                o.order_id,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                o.order_date,
                o.status,
                o.total_amount
             FROM orders o
             JOIN customers c
                ON o.customer_id = c.customer_id
             WHERE o.order_id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        // Ownership check: staff and administrators may open any order, but a
        // customer may only open their own. 404 is returned above rather than
        // 403 so that order ids cannot be probed for existence.
        if (
            req.user.role === 'customer' &&
            Number(req.user.customer_id) !== Number(orders[0].customer_id)
        ) {
            return res.status(403).json({
                error: 'You may only view your own orders'
            });
        }

        const items = await connection.query(
            `SELECT
                oi.order_item_id,
                oi.item_id,
                mi.item_name,
                oi.quantity,
                oi.unit_price,
                oi.subtotal
             FROM order_items oi
             JOIN menu_items mi
                ON oi.item_id = mi.item_id
             WHERE oi.order_id = ?
             ORDER BY oi.order_item_id`,
            [orderId]
        );

        // Tell the client which transitions are legal from here, so the UI
        // renders the right buttons without re-implementing the rules.
        const currentStatus = orders[0].status;

        res.json({
            order: orders[0],
            items: items,
            allowed_next_statuses: ALLOWED_TRANSITIONS[currentStatus] || []
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch order'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// ============================================================================
//  PUT /api/orders/:id/status — move an order along its lifecycle (FR5)
// ============================================================================
//  Body: { "status": "Preparing" | "Ready" | "Completed" | "Cancelled" }
//
//  Transitioning to Completed is the only move that consumes stock, so the
//  payment and inventory checks run for that one transition only. Preparing,
//  Ready and Cancelled need neither — a cancelled order never touched stock.
//
//  This replaces the old POST /:id/process, which could only do
//  Pending -> Completed and skipped the intermediate states entirely.
// ============================================================================
router.put('/:id/status', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                error: 'Invalid order ID'
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // 1. Get the order
        const orders = await connection.query(
            `SELECT
                order_id,
                customer_id,
                status,
                total_amount
             FROM orders
             WHERE order_id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                error: 'Order not found'
            });
        }

        const order = orders[0];

        // 2. Validate the requested move against the lifecycle map. Enforcing
        //    it here means the rules live in one place and the UI cannot
        //    invent a transition (e.g. Completed -> Pending) behind our back.
        const targetStatus = req.body.status;

        if (!ORDER_STATUSES.includes(targetStatus)) {
            await connection.rollback();

            return res.status(400).json({
                error: `status must be one of: ${ORDER_STATUSES.join(', ')}`
            });
        }

        const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];

        if (!allowedNext.includes(targetStatus)) {
            await connection.rollback();

            return res.status(400).json({
                error: `Cannot move an order from ${order.status} to ${targetStatus}`,
                current_status: order.status,
                allowed_next_statuses: allowedNext
            });
        }

        // 3. Every transition except completion is a pure status change.
        if (targetStatus !== 'Completed') {
            await connection.query(
                `UPDATE orders
                 SET status = ?
                 WHERE order_id = ?`,
                [targetStatus, orderId]
            );

            await connection.commit();

            return res.json({
                message: `Order moved to ${targetStatus}`,
                order_id: orderId,
                status: targetStatus,
                allowed_next_statuses: ALLOWED_TRANSITIONS[targetStatus] || []
            });
        }

        // --------------------------------------------------------------------
        //  From here on we are completing the order, which consumes stock.
        // --------------------------------------------------------------------

        // 4. Check for successful payment
        const payments = await connection.query(
            `SELECT
                payment_id,
                amount,
                payment_status
             FROM payments
             WHERE order_id = ?
               AND payment_status = 'Paid'
             ORDER BY payment_id DESC
             LIMIT 1`,
            [orderId]
        );

        if (payments.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                error: 'Order has no successful payment'
            });
        }

        const payment = payments[0];

        // 5. Payment must match order total
        if (Number(payment.amount) !== Number(order.total_amount)) {
            await connection.rollback();

            return res.status(400).json({
                error: 'Paid amount does not match order total'
            });
        }

        // 6. Get ordered items and their matching inventory products
        const products = await connection.query(
            `SELECT
                oi.order_item_id,
                oi.item_id,
                mi.item_name AS menu_item,
                oi.quantity AS order_quantity,
                mii.inventory_id,
                i.item_name AS inventory_item,
                i.unit,
                mii.quantity_required,
                (oi.quantity * mii.quantity_required) AS quantity_needed,
                i.quantity_in_stock
             FROM order_items oi
             JOIN menu_items mi
                ON oi.item_id = mi.item_id
             JOIN menu_item_ingredients mii
                ON oi.item_id = mii.item_id
             JOIN inventory_items i
                ON mii.inventory_id = i.inventory_id
             WHERE oi.order_id = ?
             ORDER BY oi.order_item_id`,
            [orderId]
        );

        if (products.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                error: 'No inventory mapping found for this order'
            });
        }

        // 7. Check inventory BEFORE deducting anything
        for (const product of products) {

            const quantityNeeded =
                Number(product.quantity_needed);

            const quantityInStock =
                Number(product.quantity_in_stock);

            if (quantityNeeded > quantityInStock) {

                await connection.rollback();

                return res.status(400).json({
                    error: `Insufficient stock for ${product.inventory_item}`,
                    required: quantityNeeded,
                    available: quantityInStock,
                    unit: product.unit
                });
            }
        }

        // 8. Deduct finished products from inventory
        for (const product of products) {

            const quantityNeeded =
                Number(product.quantity_needed);

            await connection.query(
                `UPDATE inventory_items
                 SET quantity_in_stock =
                     quantity_in_stock - ?
                 WHERE inventory_id = ?`,
                [
                    quantityNeeded,
                    product.inventory_id
                ]
            );

            // Record inventory usage
            await connection.query(
                `INSERT INTO stock_transactions
                 (
                    inventory_id,
                    transaction_type,
                    quantity,
                    reference_id,
                    notes
                 )
                 VALUES (?, 'Usage', ?, ?, ?)`,
                [
                    product.inventory_id,
                    -quantityNeeded,
                    orderId,
                    `Used for Order #${orderId}`
                ]
            );
        }

        // 9. Mark the order Completed
        await connection.query(
            `UPDATE orders
             SET status = 'Completed'
             WHERE order_id = ?`,
            [orderId]
        );

        // 10. Save everything
        await connection.commit();

        // 11. Response
        res.json({
            message: 'Order completed successfully',
            order_id: orderId,
            status: 'Completed',
            total_amount: Number(order.total_amount),
            allowed_next_statuses: ALLOWED_TRANSITIONS.Completed
        });

    } catch (error) {

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback failed:',
                    rollbackError
                );
            }
        }

        console.error(error);

        res.status(500).json({
            error: 'Failed to process order'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
