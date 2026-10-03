const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// GET all menu items
router.get('/', async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                mi.item_id,
                mi.item_name,
                mi.category_id,
                c.category_name,
                mi.price,
                mi.description,
                mi.availability
            FROM menu_items mi
            JOIN categories c
                ON mi.category_id = c.category_id
            ORDER BY mi.item_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch menu items'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// GET one menu item
router.get('/:id', async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        const rows = await connection.query(
            `SELECT
                item_id,
                item_name,
                category_id,
                price,
                description,
                availability
             FROM menu_items
             WHERE item_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Menu item not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch menu item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// POST a new menu item
router.post('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const {
            item_name,
            category_id,
            price,
            description,
            availability
        } = req.body;

        if (!item_name || !category_id || price === undefined) {
            return res.status(400).json({
                error: 'Item name, category and price are required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `INSERT INTO menu_items
            (item_name, category_id, price, description, availability)
            VALUES (?, ?, ?, ?, ?)`,
            [
                item_name,
                category_id,
                price,
                description || null,
                availability !== undefined ? availability : 1
            ]
        );

        res.status(201).json({
            message: 'Menu item created successfully',
            item_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to create menu item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// UPDATE a menu item
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        const {
            item_name,
            category_id,
            price,
            description,
            availability
        } = req.body;

        if (!item_name || !category_id || price === undefined) {
            return res.status(400).json({
                error: 'Item name, category and price are required'
            });
        }

        connection = await pool.getConnection();

        await connection.query(
            `UPDATE menu_items
             SET item_name = ?,
                 category_id = ?,
                 price = ?,
                 description = ?,
                 availability = ?
             WHERE item_id = ?`,
            [
                item_name,
                category_id,
                price,
                description || null,
                availability !== undefined ? availability : 1,
                id
            ]
        );

        res.json({
            message: 'Menu item updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update menu item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// DELETE a menu item
router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        await connection.query(
            `DELETE FROM menu_items
             WHERE item_id = ?`,
            [id]
        );

        res.json({
            message: 'Menu item deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete menu item'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ============================================================================
//  RECIPE MAPPING  (FR8)
// ============================================================================
//  menu_item_ingredients says how much of each inventory item one unit of a
//  menu item consumes. It is what makes automatic stock deduction work when an
//  order is completed.
//
//  Until these endpoints existed there was no way to create a mapping except by
//  hand in SQL, and a menu item with no mapping cannot be ordered at all
//  (routes/orders.js refuses it with "No inventory mapping found"). That made
//  FR8 fragile: adding a menu item silently produced an un-orderable dish.
//
//  Route order note: these paths have two segments after /api/menu, so they can
//  never be captured by the single-segment GET /:id above.
// ============================================================================


// GET the recipe for one menu item
router.get('/:id/ingredients', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const itemId = Number(req.params.id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                error: 'Invalid menu item ID'
            });
        }

        connection = await pool.getConnection();

        const menuItem = await connection.query(
            `SELECT item_id, item_name
             FROM menu_items
             WHERE item_id = ?`,
            [itemId]
        );

        if (menuItem.length === 0) {
            return res.status(404).json({
                error: 'Menu item not found'
            });
        }

        const ingredients = await connection.query(
            `SELECT
                mii.ingredient_id,
                mii.inventory_id,
                i.item_name AS inventory_item,
                i.unit,
                i.quantity_in_stock,
                mii.quantity_required
             FROM menu_item_ingredients mii
             JOIN inventory_items i
                ON mii.inventory_id = i.inventory_id
             WHERE mii.item_id = ?
             ORDER BY i.item_name`,
            [itemId]
        );

        res.json({
            item_id: menuItem[0].item_id,
            item_name: menuItem[0].item_name,
            ingredients: ingredients
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch the recipe'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// PUT — replace the whole recipe for one menu item
//
// Replace-wholesale rather than add/remove one row at a time: the client sends
// the complete list it wants, which makes the endpoint idempotent and removes
// any chance of the UI's view drifting from the database.
//
// Body: { "ingredients": [ { "inventory_id": 12, "quantity_required": 1.0 }, ... ] }
// An empty array is valid and clears the recipe.
router.put('/:id/ingredients', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const itemId = Number(req.params.id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                error: 'Invalid menu item ID'
            });
        }

        const { ingredients } = req.body;

        if (!Array.isArray(ingredients)) {
            return res.status(400).json({
                error: 'ingredients must be an array'
            });
        }

        // --- validate before touching anything -----------------------------
        const seen = new Set();

        for (const line of ingredients) {
            const inventoryId = Number(line.inventory_id);
            const quantity = Number(line.quantity_required);

            if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
                return res.status(400).json({
                    error: 'Every ingredient needs a valid inventory_id'
                });
            }

            if (!Number.isFinite(quantity) || quantity <= 0) {
                return res.status(400).json({
                    error: 'quantity_required must be greater than zero'
                });
            }

            // A duplicate would deduct the same stock twice for one order,
            // which is exactly what the UNIQUE key on (item_id, inventory_id)
            // prevents - so reject it with a clear message instead of letting
            // the database raise a constraint error.
            if (seen.has(inventoryId)) {
                return res.status(400).json({
                    error: 'The same inventory item appears more than once'
                });
            }

            seen.add(inventoryId);
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const menuItem = await connection.query(
            'SELECT item_id FROM menu_items WHERE item_id = ?',
            [itemId]
        );

        if (menuItem.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                error: 'Menu item not found'
            });
        }

        // Every referenced inventory item must exist.
        for (const line of ingredients) {
            const exists = await connection.query(
                'SELECT inventory_id FROM inventory_items WHERE inventory_id = ?',
                [Number(line.inventory_id)]
            );

            if (exists.length === 0) {
                await connection.rollback();

                return res.status(400).json({
                    error: `Inventory item ${line.inventory_id} does not exist`
                });
            }
        }

        await connection.query(
            'DELETE FROM menu_item_ingredients WHERE item_id = ?',
            [itemId]
        );

        for (const line of ingredients) {
            await connection.query(
                `INSERT INTO menu_item_ingredients
                 (item_id, inventory_id, quantity_required)
                 VALUES (?, ?, ?)`,
                [
                    itemId,
                    Number(line.inventory_id),
                    Number(line.quantity_required)
                ]
            );
        }

        await connection.commit();

        res.json({
            message: 'Recipe saved successfully',
            item_id: itemId,
            ingredient_count: ingredients.length
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        console.error(error);

        res.status(500).json({
            error: 'Failed to save the recipe'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
