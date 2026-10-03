const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// ===============================
// GET ALL SUPPLIERS
// ===============================
router.get('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                supplier_id,
                supplier_name,
                contact_person,
                phone,
                email,
                address
            FROM suppliers
            ORDER BY supplier_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch suppliers'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// GET ONE SUPPLIER
// ===============================
router.get('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(
            `
            SELECT
                supplier_id,
                supplier_name,
                contact_person,
                phone,
                email,
                address
            FROM suppliers
            WHERE supplier_id = ?
            `,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Supplier not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch supplier'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// ADD SUPPLIER
// ===============================
router.post('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address
        } = req.body;

        if (!supplier_name) {
            return res.status(400).json({
                error: 'Supplier name is required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `
            INSERT INTO suppliers
            (
                supplier_name,
                contact_person,
                phone,
                email,
                address
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                supplier_name,
                contact_person || null,
                phone || null,
                email || null,
                address || null
            ]
        );

        res.status(201).json({
            message: 'Supplier created successfully',
            supplier_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to create supplier'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// UPDATE SUPPLIER
// ===============================
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address
        } = req.body;

        if (!supplier_name) {
            return res.status(400).json({
                error: 'Supplier name is required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `
            UPDATE suppliers
            SET
                supplier_name = ?,
                contact_person = ?,
                phone = ?,
                email = ?,
                address = ?
            WHERE supplier_id = ?
            `,
            [
                supplier_name,
                contact_person || null,
                phone || null,
                email || null,
                address || null,
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Supplier not found'
            });
        }

        res.json({
            message: 'Supplier updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update supplier'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ===============================
// DELETE SUPPLIER
// ===============================
router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const result = await connection.query(
            `
            DELETE FROM suppliers
            WHERE supplier_id = ?
            `,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Supplier not found'
            });
        }

        res.json({
            message: 'Supplier deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete supplier'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
