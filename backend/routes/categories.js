const express = require('express');
const pool = require('../config/database');

const { verifyToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();


// GET all categories
router.get('/', async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = await connection.query(`
            SELECT
                category_id,
                category_name,
                description
            FROM categories
            ORDER BY category_id
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to fetch categories'
        });

    } finally {
        if (connection) connection.release();
    }
});


// GET one category
router.get('/:id', async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        const rows = await connection.query(
            `SELECT
                category_id,
                category_name,
                description
             FROM categories
             WHERE category_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to fetch category'
        });

    } finally {
        if (connection) connection.release();
    }
});


// POST category
router.post('/', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { category_name, description } = req.body;

        if (!category_name) {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `INSERT INTO categories
            (category_name, description)
            VALUES (?, ?)`,
            [category_name, description || null]
        );

        res.status(201).json({
            message: 'Category created successfully',
            category_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to create category'
        });

    } finally {
        if (connection) connection.release();
    }
});


// UPDATE category
router.put('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;
        const { category_name, description } = req.body;

        if (!category_name) {
            return res.status(400).json({
                error: 'Category name is required'
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(
            `UPDATE categories
             SET category_name = ?,
                 description = ?
             WHERE category_id = ?`,
            [
                category_name,
                description || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }

        res.json({
            message: 'Category updated successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Failed to update category'
        });

    } finally {
        if (connection) connection.release();
    }
});


// DELETE category
router.delete('/:id', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        connection = await pool.getConnection();

        await connection.query(
            `DELETE FROM categories
             WHERE category_id = ?`,
            [id]
        );

        res.json({
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete category'
        });

    } finally {
        if (connection) connection.release();
    }
});


module.exports = router;
