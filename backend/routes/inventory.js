const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// ==========================================
// GET ALL INVENTORY ITEMS
// ==========================================

router.get('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                i.inventory_id,
                i.item_name,
                i.unit,
                i.quantity_in_stock,
                i.reorder_level,
                i.unit_cost,
                i.supplier_id,
                s.supplier_name
            FROM inventory_items i
            LEFT JOIN suppliers s
                ON i.supplier_id = s.supplier_id
            ORDER BY i.inventory_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch inventory'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// GET LOW-STOCK ITEMS
// ==========================================

// IMPORTANT: this route MUST stay declared before `/:id` below.
// Express matches routes in declaration order, so if `/:id` came first then
// a request to /api/inventory/low-stock would be captured by `/:id` with
// id = "low-stock" and always return 404 "Inventory item not found".
router.get('/low-stock', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                i.inventory_id,
                i.item_name,
                i.unit,
                i.quantity_in_stock,
                i.reorder_level,
                s.supplier_name
            FROM inventory_items i
            LEFT JOIN suppliers s
                ON i.supplier_id = s.supplier_id
            WHERE i.quantity_in_stock <= i.reorder_level
            ORDER BY i.quantity_in_stock ASC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch low-stock items'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// GET ONE INVENTORY ITEM
// ==========================================

router.get('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                i.inventory_id,
                i.item_name,
                i.unit,
                i.quantity_in_stock,
                i.reorder_level,
                i.unit_cost,
                i.supplier_id,
                s.supplier_name
            FROM inventory_items i
            LEFT JOIN suppliers s
                ON i.supplier_id = s.supplier_id
            WHERE i.inventory_id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Inventory item not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch inventory item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// CREATE INVENTORY ITEM
// ==========================================

router.post('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            item_name,
            unit,
            quantity_in_stock,
            reorder_level,
            unit_cost,
            supplier_id
        } = req.body;

        if (
            !item_name ||
            !unit ||
            quantity_in_stock === undefined ||
            reorder_level === undefined ||
            unit_cost === undefined ||
            !supplier_id
        ) {
            return res.status(400).json({
                error: 'All inventory fields are required'
            });
        }

        if (
            Number(quantity_in_stock) < 0 ||
            Number(reorder_level) < 0 ||
            Number(unit_cost) < 0
        ) {
            return res.status(400).json({
                error: 'Quantity, reorder level and unit cost cannot be negative'
            });
        }

        connection = await pool.getConnection();

        // Check supplier
        const supplier = await connection.query(
            `SELECT supplier_id
             FROM suppliers
             WHERE supplier_id = ?`,
            [supplier_id]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                error: 'Supplier not found'
            });
        }

        const result = await connection.query(
            `INSERT INTO inventory_items
            (
                item_name,
                unit,
                quantity_in_stock,
                reorder_level,
                unit_cost,
                supplier_id
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                item_name,
                unit,
                quantity_in_stock,
                reorder_level,
                unit_cost,
                supplier_id
            ]
        );

        res.status(201).json({
            message: 'Inventory item created successfully',
            inventory_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to create inventory item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// UPDATE INVENTORY ITEM
// ==========================================

router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        const {
            item_name,
            unit,
            quantity_in_stock,
            reorder_level,
            unit_cost,
            supplier_id
        } = req.body;

        if (
            !item_name ||
            !unit ||
            quantity_in_stock === undefined ||
            reorder_level === undefined ||
            unit_cost === undefined ||
            !supplier_id
        ) {
            return res.status(400).json({
                error: 'All inventory fields are required'
            });
        }

        connection = await pool.getConnection();

        // Check supplier
        const supplier = await connection.query(
            `SELECT supplier_id
             FROM suppliers
             WHERE supplier_id = ?`,
            [supplier_id]
        );

        if (supplier.length === 0) {
            return res.status(404).json({
                error: 'Supplier not found'
            });
        }

        const result = await connection.query(
            `UPDATE inventory_items
             SET
                item_name = ?,
                unit = ?,
                quantity_in_stock = ?,
                reorder_level = ?,
                unit_cost = ?,
                supplier_id = ?
             WHERE inventory_id = ?`,
            [
                item_name,
                unit,
                quantity_in_stock,
                reorder_level,
                unit_cost,
                supplier_id,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Inventory item not found'
            });
        }

        res.json({
            message: 'Inventory item updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update inventory item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// DELETE INVENTORY ITEM
// ==========================================

router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        const result = await connection.query(
            `DELETE FROM inventory_items
             WHERE inventory_id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Inventory item not found'
            });
        }

        res.json({
            message: 'Inventory item deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete inventory item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==========================================
// STOCK IN
// ==========================================

router.post('/stock-in', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            inventory_id,
            quantity,
            supplier_id
        } = req.body;

        if (!inventory_id || !quantity) {
            return res.status(400).json({
                error: 'inventory_id and quantity are required'
            });
        }

        if (Number(quantity) <= 0) {
            return res.status(400).json({
                error: 'Quantity must be greater than zero'
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const inventory = await connection.query(
            `SELECT
                inventory_id,
                item_name,
                quantity_in_stock
             FROM inventory_items
             WHERE inventory_id = ?`,
            [inventory_id]
        );

        if (inventory.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                error: 'Inventory item not found'
            });
        }

        const item = inventory[0];

        await connection.query(
            `UPDATE inventory_items
             SET quantity_in_stock = quantity_in_stock + ?
             WHERE inventory_id = ?`,
            [quantity, inventory_id]
        );

        await connection.query(
            `INSERT INTO stock_transactions
             (
                inventory_id,
                transaction_type,
                quantity,
                reference_id,
                notes
             )
             VALUES (?, 'Purchase', ?, ?, ?)`,
            [
                inventory_id,
                quantity,
                supplier_id || null,
                `Received ${quantity} ${item.item_name}`
            ]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Stock added successfully',
            inventory_id: Number(inventory_id),
            item_name: item.item_name,
            quantity_added: Number(quantity)
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
            error: 'Failed to add stock'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
