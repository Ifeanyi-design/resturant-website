const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const { verifyToken, requireStaff, requireAdmin } = require("../middleware/auth");


// ========================================
// GET ALL BANK ACCOUNTS
// ========================================

router.get("/", verifyToken, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const accounts = await connection.query(`
            SELECT
                account_id,
                bank_name,
                account_name,
                account_number,
                is_active,
                created_at
            FROM restaurant_bank_accounts
            ORDER BY account_id DESC
        `);

        res.json(accounts);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch bank accounts"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// GET ONE BANK ACCOUNT
// ========================================

router.get("/:id", verifyToken, async (req, res) => {
    let connection;

    try {
        const accountId = Number(req.params.id);

        if (!Number.isInteger(accountId) || accountId <= 0) {
            return res.status(400).json({
                error: "Invalid account ID"
            });
        }

        connection = await pool.getConnection();

        const accounts = await connection.query(`
            SELECT
                account_id,
                bank_name,
                account_name,
                account_number,
                is_active,
                created_at
            FROM restaurant_bank_accounts
            WHERE account_id = ?
        `, [accountId]);

        if (accounts.length === 0) {
            return res.status(404).json({
                error: "Bank account not found"
            });
        }

        res.json(accounts[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to fetch bank account"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// ADD BANK ACCOUNT
// ========================================

router.post("/", verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        const {
            bank_name,
            account_name,
            account_number,
            is_active
        } = req.body;

        if (
            !bank_name ||
            !account_name ||
            !account_number
        ) {
            return res.status(400).json({
                error:
                    "Bank name, account name and account number are required"
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(`
            INSERT INTO restaurant_bank_accounts
            (
                bank_name,
                account_name,
                account_number,
                is_active
            )
            VALUES (?, ?, ?, ?)
        `, [
            bank_name,
            account_name,
            account_number,
            is_active === undefined
                ? 1
                : Number(is_active)
        ]);

        res.status(201).json({
            message: "Bank account added successfully",
            account_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to add bank account"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// UPDATE BANK ACCOUNT
// ========================================

router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        const accountId = Number(req.params.id);

        if (!Number.isInteger(accountId) || accountId <= 0) {
            return res.status(400).json({
                error: "Invalid account ID"
            });
        }

        const {
            bank_name,
            account_name,
            account_number,
            is_active
        } = req.body;

        if (
            !bank_name ||
            !account_name ||
            !account_number
        ) {
            return res.status(400).json({
                error:
                    "Bank name, account name and account number are required"
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(`
            UPDATE restaurant_bank_accounts
            SET
                bank_name = ?,
                account_name = ?,
                account_number = ?,
                is_active = ?
            WHERE account_id = ?
        `, [
            bank_name,
            account_name,
            account_number,
            is_active === undefined
                ? 1
                : Number(is_active),
            accountId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Bank account not found"
            });
        }

        res.json({
            message: "Bank account updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to update bank account"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// DELETE BANK ACCOUNT
// ========================================

router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        const accountId = Number(req.params.id);

        if (!Number.isInteger(accountId) || accountId <= 0) {
            return res.status(400).json({
                error: "Invalid account ID"
            });
        }

        connection = await pool.getConnection();

        const result = await connection.query(`
            DELETE FROM restaurant_bank_accounts
            WHERE account_id = ?
        `, [accountId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: "Bank account not found"
            });
        }

        res.json({
            message: "Bank account deleted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to delete bank account"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
