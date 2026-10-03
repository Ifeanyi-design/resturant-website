// ============================================================================
//  Central environment configuration
// ============================================================================
//  dotenv is loaded exactly once, here. Every other module imports its settings
//  from this file instead of touching process.env directly, which removes the
//  whole class of bug where a value is read before dotenv has run.
//
//  The .env path is resolved relative to THIS FILE, not to process.cwd().
//  Without that, dotenv looks for .env in whatever directory the process was
//  started from, and `node some/other/dir/script.js` silently loads no config
//  at all. That failure is confusing precisely because nothing complains until
//  something that needs a setting blows up later.
// ============================================================================
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '..', '.env')
});

const env = {
    port: Number(process.env.PORT) || 3000,

    // Comma-separated list of origins allowed to call the API from another
    // host. Only needed for a split deployment (frontend on Vercel, API on
    // Render). Empty means "allow anything", which is what local development
    // needs - in production the frontend is served by this same process, so
    // requests are same-origin and CORS is not involved.
    allowedOrigins: process.env.ALLOWED_ORIGINS || '',

    // Deliberately NOT validated here.
    // The database setup scripts (database/setup.js, test-db.js) must be able
    // to run without an auth secret. The two modules that genuinely cannot
    // work without it — middleware/auth.js and routes/auth.js — fail loudly at
    // load time instead, which is where the mistake should surface.
    jwtSecret: process.env.JWT_SECRET || null,

    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'restaurant_system',
        connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,

        // Optional escape hatch: Termux on Android and some container images
        // expose only a Unix socket instead of a TCP port. When set, this takes
        // priority over host/port. Leave unset on a normal install.
        socketPath: process.env.DB_SOCKET_PATH || null
    }
};

module.exports = env;
