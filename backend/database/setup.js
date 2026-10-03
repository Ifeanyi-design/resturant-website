// ============================================================================
//  Database setup runner
// ============================================================================
//  Applies schema.sql and seed.sql through the mariadb driver, so you do NOT
//  need the `mysql` or `mariadb` command-line client installed.
//
//  LOCAL (reads backend/.env):
//      npm run db:setup        -- schema.sql, then seed.sql, then test accounts
//      npm run db:schema       -- schema.sql only (drops and recreates tables)
//      npm run db:seed         -- seed.sql only (clears and re-seeds data)
//
//  REMOTE (no .env editing needed):
//      npm run db:setup:remote -- --url="mysql://user:pass@host:port/dbname"
//
//  The --url form exists so you can populate a hosted database (Aiven, Railway,
//  PlanetScale...) without swapping your .env back and forth, which is the
//  easiest way to break local development by forgetting to change it back.
//
//  The database NAME in the URL is honoured: schema.sql hardcodes
//  `restaurant_system`, so this rewrites it when the target is called something
//  else (Aiven hands you `defaultdb`). Without that, seeding a remote database
//  would quietly create the wrong database and the app would still see nothing.
// ============================================================================
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');

const LOCAL_DATABASE = 'restaurant_system';
const DEFAULT_FILES = ['schema.sql', 'seed.sql'];


// ---------------------------------------------------------------------------
//  Arguments
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const options = { files: [], url: null, ssl: null };

    for (const arg of argv) {
        if (arg.startsWith('--url=')) {
            options.url = arg.slice('--url='.length).replace(/^["']|["']$/g, '');
        } else if (arg === '--ssl') {
            options.ssl = true;
        } else if (arg === '--no-ssl') {
            options.ssl = false;
        } else if (!arg.startsWith('--')) {
            options.files.push(arg);
        }
    }

    return options;
}


// ---------------------------------------------------------------------------
//  Connection settings: either the --url, or backend/.env
// ---------------------------------------------------------------------------
function resolveTarget(options) {
    if (!options.url) {
        const socketPath = process.env.DB_SOCKET_PATH;

        return {
            label: socketPath || `${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`,
            database: process.env.DB_NAME || LOCAL_DATABASE,
            connection: {
                ...(socketPath
                    ? { socketPath }
                    : {
                        host: process.env.DB_HOST || '127.0.0.1',
                        port: Number(process.env.DB_PORT) || 3306
                    }),
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || ''
            },
            ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true'
        };
    }

    // mysql://user:pass@host:port/dbname?ssl-mode=REQUIRED
    const parsed = new URL(options.url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || LOCAL_DATABASE;

    // Managed providers require TLS. Default it on for a remote URL unless the
    // caller explicitly said --no-ssl.
    const wantsSsl = options.ssl !== null
        ? options.ssl
        : true;

    return {
        label: `${parsed.hostname}:${parsed.port || 3306}`,
        database,
        connection: {
            host: parsed.hostname,
            port: Number(parsed.port) || 3306,
            user: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password)
        },
        ssl: wantsSsl
    };
}


async function run() {
    const options = parseArgs(process.argv.slice(2));
    const files = options.files.length > 0 ? options.files : DEFAULT_FILES;
    const target = resolveTarget(options);

    let connection;

    try {
        connection = await mariadb.createConnection({
            ...target.connection,
            // schema.sql and seed.sql both contain many statements, so the
            // driver has to be told to accept more than one per query() call.
            multipleStatements: true,
            connectTimeout: 15000,
            ...(target.ssl ? { ssl: { rejectUnauthorized: false } } : {})
        });

        console.log(`Connected to ${target.label} as "${target.connection.user}".`);
        console.log(`Target database: ${target.database}${target.ssl ? '  (TLS)' : ''}`);

        for (const name of files) {
            const filePath = path.join(__dirname, name);

            if (!fs.existsSync(filePath)) {
                throw new Error(`SQL file not found: ${filePath}`);
            }

            let sql = fs.readFileSync(filePath, 'utf8');

            // schema.sql/seed.sql hardcode `restaurant_system`. Point them at
            // whatever database this run is actually targeting.
            if (target.database !== LOCAL_DATABASE) {
                sql = sql.split(LOCAL_DATABASE).join(target.database);
            }

            console.log(`\nApplying ${name} ...`);

            const startedAt = Date.now();
            await connection.query(sql);
            console.log(`   ${name} applied in ${Date.now() - startedAt} ms.`);
        }

        // Report what actually landed, so "it said complete" and "the app can
        // log in" cannot drift apart.
        const tables = await connection.query(`SHOW TABLES FROM \`${target.database}\``);
        const tableCount = Array.isArray(tables) ? tables.length : 0;

        let userCount = 'n/a';
        try {
            const rows = await connection.query(
                `SELECT COUNT(*) AS n FROM \`${target.database}\`.users`
            );
            userCount = Number(rows[0].n);
        } catch (error) {
            userCount = 'users table missing';
        }

        console.log('\nDatabase setup complete.');
        console.log(`   tables in ${target.database}: ${tableCount}`);
        console.log(`   users in  ${target.database}: ${userCount}`);

        if (tableCount === 0) {
            console.log('\n   WARNING: no tables were created. Check the output above.');
        }

    } catch (error) {
        console.error('\nDatabase setup FAILED.');

        if (error.code === 'ECONNREFUSED') {
            console.error(`Could not reach the database at ${target.label}.`);
            console.error('If this is your local machine, is MariaDB running?');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error(`The username or password for "${target.connection.user}" was rejected.`);
            console.error('Copy the credentials again straight from your provider console.');
        } else if (String(error.message).includes('certificate') || String(error.message).includes('SSL')) {
            console.error('TLS problem. Managed providers need it; try adding --ssl or --no-ssl.');
            console.error(error.message);
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
