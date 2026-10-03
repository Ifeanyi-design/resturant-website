const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const env = require('../config/env');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// No hardcoded fallback. A missing secret must stop the server, not silently
// downgrade every token in the system to a value anyone can read on GitHub.
if (!env.jwtSecret) {
    throw new Error(
        'JWT_SECRET is not set, so login tokens cannot be signed.\n' +
        'Add JWT_SECRET to backend/.env — see backend/.env.example for the format.'
    );
}

const JWT_SECRET = env.jwtSecret;


// ========================================
// LOGIN
// ========================================

router.post('/login', async (req, res) => {
    let connection;

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        connection = await pool.getConnection();

        const rows = await connection.query(
            `SELECT *
             FROM users
             WHERE email = ?`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const user = rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Login failed'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// GET ALL USERS
// ========================================

router.get('/users', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const users = await connection.query(`
            SELECT
                user_id,
                first_name,
                last_name,
                email,
                role,
                created_at
            FROM users
            ORDER BY user_id
        `);

        res.json(users);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch users'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// GET ONE USER
// ========================================

router.get('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const users = await connection.query(`
            SELECT
                user_id,
                first_name,
                last_name,
                email,
                role,
                created_at
            FROM users
            WHERE user_id = ?
        `, [req.params.id]);

        if (users.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json(users[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to fetch user'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// CREATE USER
// ========================================

router.post('/users', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        const {
            first_name,
            last_name,
            email,
            password,
            role
        } = req.body;

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                error: 'First name, last name, email and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters'
            });
        }

        const userRole = role || 'staff';

        if (!['admin', 'staff'].includes(userRole)) {
            return res.status(400).json({
                error: 'Role must be admin or staff'
            });
        }

        connection = await pool.getConnection();

        const existingUser = await connection.query(
            `SELECT user_id
             FROM users
             WHERE email = ?`,
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                error: 'Email already exists'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await connection.query(
            `INSERT INTO users
             (
                first_name,
                last_name,
                email,
                password_hash,
                role
             )
             VALUES (?, ?, ?, ?, ?)`,
            [
                first_name,
                last_name,
                email,
                passwordHash,
                userRole
            ]
        );

        res.status(201).json({
            message: 'User created successfully',
            user_id: Number(result.insertId)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to create user'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// UPDATE USER
// ========================================

router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        const {
            first_name,
            last_name,
            email,
            password,
            role
        } = req.body;

        if (!first_name || !last_name || !email || !role) {
            return res.status(400).json({
                error: 'First name, last name, email and role are required'
            });
        }

        if (!['admin', 'staff'].includes(role)) {
            return res.status(400).json({
                error: 'Role must be admin or staff'
            });
        }

        connection = await pool.getConnection();

        const existingUser = await connection.query(
            `SELECT user_id
             FROM users
             WHERE user_id = ?`,
            [req.params.id]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const duplicateEmail = await connection.query(
            `SELECT user_id
             FROM users
             WHERE email = ?
             AND user_id != ?`,
            [email, req.params.id]
        );

        if (duplicateEmail.length > 0) {
            return res.status(409).json({
                error: 'Email already exists'
            });
        }


        if (password) {

            if (password.length < 6) {
                return res.status(400).json({
                    error: 'Password must be at least 6 characters'
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);

            await connection.query(
                `UPDATE users
                 SET
                    first_name = ?,
                    last_name = ?,
                    email = ?,
                    password_hash = ?,
                    role = ?
                 WHERE user_id = ?`,
                [
                    first_name,
                    last_name,
                    email,
                    passwordHash,
                    role,
                    req.params.id
                ]
            );

        } else {

            await connection.query(
                `UPDATE users
                 SET
                    first_name = ?,
                    last_name = ?,
                    email = ?,
                    role = ?
                 WHERE user_id = ?`,
                [
                    first_name,
                    last_name,
                    email,
                    role,
                    req.params.id
                ]
            );
        }

        res.json({
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to update user'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ========================================
// DELETE USER
// ========================================

router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        const result = await connection.query(
            `DELETE FROM users
             WHERE user_id = ?`,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        res.json({
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to delete user'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// ========================================
// CUSTOMER SIGN UP
// ========================================

router.post('/customer/signup', async (req, res) => {
    let connection;

    try {
        const {
            first_name,
            last_name,
            phone,
            email,
            password
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                message: 'First name, last name, email and password are required'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters'
            });
        }

        connection = await pool.getConnection();

        // Check whether email already exists
        const existingCustomer = await connection.query(
            `SELECT customer_id
             FROM customers
             WHERE email = ?`,
            [email]
        );

        if (existingCustomer.length > 0) {
            return res.status(409).json({
                message: 'Email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create customer
        const result = await connection.query(
            `INSERT INTO customers
             (
                first_name,
                last_name,
                phone,
                email,
                password_hash
             )
             VALUES (?, ?, ?, ?, ?)`,
            [
                first_name,
                last_name,
                phone || null,
                email,
                passwordHash
            ]
        );

        res.status(201).json({
            message: 'Customer account created successfully',
            customer_id: Number(result.insertId)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Failed to create customer account'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

// ========================================
// CUSTOMER SIGN IN
// ========================================

router.post('/customer/login', async (req, res) => {
    let connection;

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        connection = await pool.getConnection();

        const customers = await connection.query(
            `SELECT
                customer_id,
                first_name,
                last_name,
                phone,
                email,
                password_hash
             FROM customers
             WHERE email = ?`,
            [email]
        );

        if (customers.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const customer = customers[0];

        const passwordMatch = await bcrypt.compare(
            password,
            customer.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            {
                customer_id: customer.customer_id,
                role: 'customer'
            },
            JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        res.json({
            message: 'Customer login successful',
            token,
            customer: {
                customer_id: customer.customer_id,
                first_name: customer.first_name,
                last_name: customer.last_name,
                phone: customer.phone,
                email: customer.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Customer login failed'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
