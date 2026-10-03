const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// GET ALL PAYMENTS
router.get('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const payments = await connection.query(`
            SELECT
                p.payment_id,
                p.order_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                p.payment_method,
                p.amount,
                p.payment_status,
                p.payment_date
            FROM payments p
            JOIN orders o
                ON p.order_id = o.order_id
            JOIN customers c
                ON o.customer_id = c.customer_id
            ORDER BY p.payment_id DESC
        `);

        res.json(payments);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch payments'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// GET ONE PAYMENT
router.get('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const payments = await connection.query(`
            SELECT
                p.payment_id,
                p.order_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                p.payment_method,
                p.amount,
                p.payment_status,
                p.payment_date
            FROM payments p
            JOIN orders o
                ON p.order_id = o.order_id
            JOIN customers c
                ON o.customer_id = c.customer_id
            WHERE p.payment_id = ?
        `, [req.params.id]);

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        res.json(payments[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch payment'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// CREATE PAYMENT
// CREATE PAYMENT
router.post('/', verifyToken, async (req, res) => {
    let connection;

    try {
        const {
            order_id,
            payment_method,
            amount
        } = req.body;

        if (!order_id || !payment_method || !amount) {
            return res.status(400).json({
                error:
                    'order_id, payment_method and amount are required'
            });
        }

        if (
            payment_method !== 'Transfer' &&
            payment_method !== 'Card'
        ) {
            return res.status(400).json({
                error:
                    'Payment method must be Card or Transfer'
            });
        }

        connection = await pool.getConnection();

        const orders = await connection.query(
            `SELECT
                order_id,
                total_amount,
                status
             FROM orders
             WHERE order_id = ?`,
            [order_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        const order = orders[0];

        if (
            Number(amount) !==
            Number(order.total_amount)
        ) {
            return res.status(400).json({
                error:
                    'Payment amount must match the order total'
            });
        }

        // Bank Transfer requires admin approval.
        // Card is marked Paid for now.
        const paymentStatus =
            payment_method === 'Transfer'
                ? 'Pending'
                : 'Paid';

        const result =
            await connection.query(
                `INSERT INTO payments
                (
                    order_id,
                    payment_method,
                    amount,
                    payment_status
                )
                VALUES (?, ?, ?, ?)`,
                [
                    order_id,
                    payment_method,
                    amount,
                    paymentStatus
                ]
            );

        res.status(201).json({
            message:
                payment_method === 'Transfer'
                    ? 'Bank transfer submitted for approval'
                    : 'Payment recorded successfully',

            payment_id:
                Number(result.insertId),

            order_id:
                Number(order_id),

            amount:
                Number(amount),

            payment_status:
                paymentStatus
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Failed to record payment'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

// UPDATE PAYMENT
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            payment_method,
            amount,
            payment_status
        } = req.body;

        if (!payment_method || !amount || !payment_status) {
            return res.status(400).json({
                error: 'payment_method, amount and payment_status are required'
            });
        }

        connection = await pool.getConnection();

        const payments = await connection.query(
            `SELECT payment_id, order_id
             FROM payments
             WHERE payment_id = ?`,
            [req.params.id]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        const payment = payments[0];

        const orders = await connection.query(
            `SELECT total_amount
             FROM orders
             WHERE order_id = ?`,
            [payment.order_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        if (Number(amount) !== Number(orders[0].total_amount)) {
            return res.status(400).json({
                error: 'Payment amount must match the order total'
            });
        }

        await connection.query(
            `UPDATE payments
             SET
                payment_method = ?,
                amount = ?,
                payment_status = ?
             WHERE payment_id = ?`,
            [
                payment_method,
                amount,
                payment_status,
                req.params.id
            ]
        );

        res.json({
            message: 'Payment updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update payment'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// APPROVE PAYMENT
router.put('/:id/approve', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const payments = await connection.query(
            `SELECT
                payment_id,
                order_id,
                payment_status
             FROM payments
             WHERE payment_id = ?`,
            [req.params.id]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        const payment = payments[0];

        if (payment.payment_status !== 'Pending') {
            return res.status(400).json({
                error: 'Only pending payments can be approved'
            });
        }

        await connection.query(
            `UPDATE payments
             SET payment_status = 'Paid'
             WHERE payment_id = ?`,
            [req.params.id]
        );

        res.json({
            message: 'Payment approved successfully',
            payment_id: Number(payment.payment_id),
            order_id: Number(payment.order_id),
            payment_status: 'Paid'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to approve payment'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// DELETE PAYMENT
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const result = await connection.query(
            `DELETE FROM payments
             WHERE payment_id = ?`,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        res.json({
            message: 'Payment deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete payment'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
