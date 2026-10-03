const mariadb = require('mariadb');

const env = require('./env');

const { host, port, user, password, database, connectionLimit, socketPath } = env.db;

// Managed MySQL providers (Aiven, PlanetScale, Clever Cloud...) require the
// connection to be encrypted. A local MariaDB does not, so this is opt-in via
// DB_SSL=true rather than always-on.
//
// rejectUnauthorized:false is used because these providers present their own CA
// and the Node trust store does not know it. Traffic is still encrypted; this
// only skips verifying the certificate chain. For a stricter setup, download
// the provider's CA and pass it as `ssl: { ca: fs.readFileSync(...) }`.
const ssl = String(process.env.DB_SSL || '').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = mariadb.createPool({
    ...(socketPath ? { socketPath } : { host, port }),
    user,
    password,
    database,
    connectionLimit,
    ...(ssl ? { ssl } : {})
});

module.exports = pool;
