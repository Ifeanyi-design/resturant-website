const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// ===============================
// GET ALL CUSTOMERS
// ===============================
router.get('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                customer_id,
                first_name,
                last_name,
                phone,
                email
            FROM customers
            ORDER BY customer_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch customers'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// GET ONE CUSTOMER
// ===============================
router.get('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const customerId = Number(req.params.id);

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.status(400).json({
                error: 'Invalid customer ID'
            });
        }

        connection = await pool.getConnection();

        const rows = await connection.query(
            `
            SELECT
                customer_id,
                first_name,
                last_name,
                phone,
                email
            FROM customers
            WHERE customer_id = ?
            `,
            [customerId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Customer not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch customer'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// CREATE CUSTOMER
// ===============================
router.post('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            first_name,
            last_name,
            phone,
            email
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                error: 'first_name and last_name are required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `
            INSERT INTO customers
            (
                first_name,
                last_name,
                phone,
                email
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                first_name,
                last_name,
                phone || null,
                email || null
            ]
        );

        res.status(201).json({
            message: 'Customer created successfully',
            customer_id: Number(result.insertId),
            first_name,
            last_name,
            phone: phone || null,
            email: email || null
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to create customer'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// UPDATE CUSTOMER
// ===============================
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const customerId = Number(req.params.id);

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.status(400).json({
                error: 'Invalid customer ID'
            });
        }

        const {
            first_name,
            last_name,
            phone,
            email
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                error: 'first_name and last_name are required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `
            UPDATE customers
            SET
                first_name = ?,
                last_name = ?,
                phone = ?,
                email = ?
            WHERE customer_id = ?
            `,
            [
                first_name,
                last_name,
                phone || null,
                email || null,
                customerId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Customer not found'
            });
        }

        res.json({
            message: 'Customer updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update customer'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// DELETE CUSTOMER
// ===============================
router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const customerId = Number(req.params.id);

        if (!Number.isInteger(customerId) || customerId <= 0) {
            return res.status(400).json({
                error: 'Invalid customer ID'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `
            DELETE FROM customers
            WHERE customer_id = ?
            `,
            [customerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Customer not found'
            });
        }

        res.json({
            message: 'Customer deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete customer'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
