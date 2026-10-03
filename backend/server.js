const path = require('path');

const env = require('./config/env');

const cors = require('cors');
const express = require('express');

const menuRoutes = require('./routes/menu');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const supplierRoutes = require('./routes/suppliers');
const paymentRoutes = require('./routes/payments');
const customerRoutes = require('./routes/customers');
const reportRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const bankAccountRoutes = require('./routes/bank_accounts');

const app = express();

// Render (and every other PaaS) terminates TLS at a proxy, so without this
// req.protocol and req.ip report the proxy rather than the client.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
//  CORS
// ---------------------------------------------------------------------------
//  In production the frontend is served by THIS process, so requests are
//  same-origin and CORS is not involved at all.
//
//  Set ALLOWED_ORIGINS (comma-separated) only for a split deployment - e.g. the
//  frontend on Vercel talking to this API. Left unset, everything is allowed,
//  which is what local development needs (frontend on :8080, API on :3000).
// ---------------------------------------------------------------------------
const allowedOrigins = String(env.allowedOrigins || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true
}));

app.use(express.json());


// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);

// Health probe for the hosting platform.
// Deliberately does NOT touch the database: a health check that fails when the
// database has a momentary blip makes the platform restart a service that was
// working fine.
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime_seconds: Math.round(process.uptime())
    });
});


// ---------------------------------------------------------------------------
//  Frontend
// ---------------------------------------------------------------------------
//  The static frontend is served by this same process, so the whole
//  application is ONE deployable service:
//    - no second host to configure
//    - no CORS to get wrong
//    - the API is same-origin, so no hostname is baked into the frontend
//
//  express.static serves index.html for a directory request, so
//  /admin/menu/ resolves to admin/menu/index.html.
// ---------------------------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

app.use(express.static(FRONTEND_DIR, {
    extensions: ['html'],
    // Hashed query strings (?v=1) change between deploys, so a short cache is
    // safe and keeps the pages snappy without risking stale CSS.
    maxAge: '1h'
}));


// ---------------------------------------------------------------------------
//  Fallbacks
// ---------------------------------------------------------------------------

// JSON 404 for anything under /api, so a mistyped endpoint returns a parseable
// body rather than Express's HTML error page.
app.use('/api', (req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
});

// Anything else is a bad page URL. Send the browser back to the sign-in page
// rather than showing a JSON blob in a browser tab.
app.use((req, res) => {
    res.status(404).sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Central error handler: keeps every failure a JSON response instead of an
// HTML stack trace, which the frontend fetch() calls can actually parse.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        error: 'Internal server error'
    });
});


app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    console.log(`Serving the frontend from ${FRONTEND_DIR}`);
});
