// ============================================================================
//  Create (or refresh) one test account per role
// ============================================================================
//  Usage, from backend/:
//      node database/add-test-accounts.js
//
//  Why a script and not a hand-written INSERT:
//  bcrypt hashes must be generated, not typed. Hardcoding one into a .sql file
//  means it can never be verified, and a seed that ships a broken hash fails
//  silently as "wrong password" much later. This generates the hash at run
//  time and round-trip checks it before writing.
//
//  Safe to re-run: accounts are matched by email and updated in place, so
//  running it twice does not create duplicates and does not touch any other
//  data (orders, payments and stock are left completely alone).
// ============================================================================
require('../config/env');

const bcrypt = require('bcryptjs');

const pool = require('../config/database');

const ACCOUNTS = [
    {
        kind: 'user',
        role: 'admin',
        first_name: 'Ngozi',
        last_name: 'Adebayo',
        email: 'manager@restaurant.test',
        phone: null,
        password: 'manager123',
        label: 'Administrator'
    },
    {
        kind: 'user',
        role: 'staff',
        first_name: 'Tunde',
        last_name: 'Bakare',
        email: 'cashier@restaurant.test',
        phone: null,
        password: 'cashier123',
        label: 'Staff'
    },
    {
        kind: 'customer',
        role: 'customer',
        first_name: 'Bola',
        last_name: 'Adeleke',
        email: 'bola@example.com',
        phone: '08055667788',
        password: 'bola123',
        label: 'Customer'
    }
];


async function upsertUser(connection, account, passwordHash) {
    const existing = await connection.query(
        'SELECT user_id FROM users WHERE email = ?',
        [account.email]
    );

    if (existing.length > 0) {
        await connection.query(
            `UPDATE users
             SET first_name = ?, last_name = ?, password_hash = ?, role = ?
             WHERE user_id = ?`,
            [
                account.first_name,
                account.last_name,
                passwordHash,
                account.role,
                existing[0].user_id
            ]
        );

        return { id: existing[0].user_id, action: 'updated' };
    }

    const result = await connection.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?)`,
        [
            account.first_name,
            account.last_name,
            account.email,
            passwordHash,
            account.role
        ]
    );

    return { id: Number(result.insertId), action: 'created' };
}


async function upsertCustomer(connection, account, passwordHash) {
    const existing = await connection.query(
        'SELECT customer_id FROM customers WHERE email = ?',
        [account.email]
    );

    if (existing.length > 0) {
        await connection.query(
            `UPDATE customers
             SET first_name = ?, last_name = ?, phone = ?, password_hash = ?
             WHERE customer_id = ?`,
            [
                account.first_name,
                account.last_name,
                account.phone,
                passwordHash,
                existing[0].customer_id
            ]
        );

        return { id: existing[0].customer_id, action: 'updated' };
    }

    const result = await connection.query(
        `INSERT INTO customers (first_name, last_name, phone, email, password_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [
            account.first_name,
            account.last_name,
            account.phone,
            account.email,
            passwordHash
        ]
    );

    return { id: Number(result.insertId), action: 'created' };
}


(async () => {
    let connection;

    try {
        connection = await pool.getConnection();

        const rows = [];

        for (const account of ACCOUNTS) {
            const passwordHash = await bcrypt.hash(account.password, 10);

            // Verify the hash round-trips BEFORE it reaches the database.
            const verified = await bcrypt.compare(account.password, passwordHash);

            if (!verified) {
                throw new Error(`Hash verification failed for ${account.email}`);
            }

            const result = account.kind === 'customer'
                ? await upsertCustomer(connection, account, passwordHash)
                : await upsertUser(connection, account, passwordHash);

            rows.push({ account, result });
        }

        console.log('\n  Test accounts ready. All passwords verified against their hash.\n');
        console.log('  ROLE           EMAIL                        PASSWORD       ID');
        console.log('  ' + '-'.repeat(76));

        for (const { account, result } of rows) {
            console.log(
                '  ' + account.label.padEnd(14) +
                account.email.padEnd(29) +
                account.password.padEnd(15) +
                result.id + '  (' + result.action + ')'
            );
        }

        console.log('\n  Sign in at http://localhost:8080/');
        console.log('    - choose "Admin / Staff" in the Login as box for the admin and staff accounts');
        console.log('    - choose "Customer" for the customer account');
        console.log('');

    } catch (error) {
        console.error('\n  FAILED:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.error('  Is MariaDB running? Start it with start-mariadb.bat');
        }

        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
})();
