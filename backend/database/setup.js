// ============================================================================
//  Database setup runner
// ============================================================================
//  Applies schema.sql and seed.sql through the mariadb driver, so you do NOT
//  need the `mysql` or `mariadb` command-line client installed.
//
//  Usage (from the backend/ directory):
//      npm run db:setup      -- schema.sql, then seed.sql
//      npm run db:schema     -- schema.sql only (drops and recreates tables)
//      npm run db:seed       -- seed.sql only (clears and re-seeds data)
//
//  It connects WITHOUT selecting a database first, because schema.sql is what
//  creates `restaurant_system`. Connection details come from .env.
// ============================================================================
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT) || 3306;
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const socketPath = process.env.DB_SOCKET_PATH;

const DEFAULT_FILES = ['schema.sql', 'seed.sql'];

async function run() {
    const requested = process.argv.slice(2);
    const files = requested.length > 0 ? requested : DEFAULT_FILES;

    let connection;

    try {
        connection = await mariadb.createConnection({
            ...(socketPath ? { socketPath } : { host, port }),
            user,
            password,
            // schema.sql and seed.sql both contain many statements, so the
            // driver has to be told to accept more than one per query() call.
            multipleStatements: true,
            connectTimeout: 10000
        });

        const target = socketPath ? socketPath : `${host}:${port}`;
        console.log(`Connected to MariaDB/MySQL at ${target} as "${user}".`);

        for (const name of files) {
            const filePath = path.join(__dirname, name);

            if (!fs.existsSync(filePath)) {
                throw new Error(`SQL file not found: ${filePath}`);
            }

            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`\nApplying ${name} ...`);

            const startedAt = Date.now();
            await connection.query(sql);
            const elapsed = Date.now() - startedAt;

            console.log(`   ${name} applied in ${elapsed} ms.`);
        }

        console.log('\nDatabase setup complete.');
        console.log('Demo logins:');
        console.log('   admin@restaurant.test  / admin123');
        console.log('   staff@restaurant.test  / staff123');
        console.log('   ada@example.com        / customer123');

    } catch (error) {
        console.error('\nDatabase setup FAILED.');

        // ECONNREFUSED is by far the most common cause here, so say what to do
        // about it instead of only printing the driver's error code.
        if (error.code === 'ECONNREFUSED') {
            console.error(`Could not reach the database at ${socketPath || `${host}:${port}`}.`);
            console.error('Is MariaDB/MySQL running? Check DB_HOST and DB_PORT in backend/.env');
        } else {
            console.error(error.message);
        }

        process.exitCode = 1;

    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

run();
