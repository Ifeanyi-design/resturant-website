// ============================================================================
//  Auth regression test  —  npm run test:auth
// ============================================================================
//  Proves requirement NFR2: only authenticated and authorised users can reach
//  protected records.
//
//  HOW IT WORKS
//  ------------
//  It boots the real server on port 3997 and fires requests at it with tokens
//  minted directly using the app's own secret. It does NOT use the login
//  endpoint, because login needs the database and this test must be runnable
//  without one.
//
//  THE ASSERTION
//  -------------
//    expectation 'blocked' -> response must be 401 or 403
//    expectation 'reaches' -> response must be anything EXCEPT 401 or 403
//
//  So a 500 is a PASS for a 'reaches' case: it means the middleware let the
//  request through and it only failed later, at the database.
//
//  WHY THE 'reaches' CASES USE ID 999999
//  -------------------------------------
//  This test also runs against a live database. A 'reaches' case on
//  `DELETE /api/menu/1` would really delete menu item 1 - the middleware let
//  it through, so the delete succeeds. Using an id that does not exist keeps
//  the assertion identical (the request still reaches the handler) while
//  guaranteeing the test cannot destroy seeded data.
//
//  It boots its own server instance, so stop any server you already have
//  running on port 3997 (the app's normal port, 3000, is left alone).
// ============================================================================
process.env.PORT = process.env.TEST_PORT || '3997';

const jwt = require('jsonwebtoken');

const env = require('../config/env');

const BASE = `http://localhost:${process.env.PORT}`;

const TOKENS = {
    none: null,
    admin: jwt.sign({ user_id: 1, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' }),
    staff: jwt.sign({ user_id: 2, role: 'staff' }, env.jwtSecret, { expiresIn: '1h' }),
    customer: jwt.sign({ customer_id: 1, role: 'customer' }, env.jwtSecret, { expiresIn: '1h' }),
    expired: jwt.sign({ user_id: 1, role: 'admin' }, env.jwtSecret, { expiresIn: '-1s' }),
    forged: jwt.sign({ user_id: 1, role: 'admin' }, 'wrong-secret', { expiresIn: '1h' })
};

// Boot the API in this process.
require('../server.js');

async function probe(method, path, tokenName) {
    const headers = {};
    const token = TOKENS[tokenName];

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(BASE + path, {
            method,
            headers,
            body: method === 'GET' ? undefined : JSON.stringify({})
        });

        const text = await response.text();

        let detail = text;
        try {
            const parsed = JSON.parse(text);
            detail = parsed.error || parsed.message || text;
        } catch (error) {
            // Non-JSON body — keep the raw text.
        }

        return { status: response.status, detail: String(detail).slice(0, 44) };

    } catch (error) {
        return { status: 'ERR', detail: error.message };
    }
}

// [method, path, token, expectation, label]
const CASES = [
    // public routes must still work with no token
    ['GET',  '/api/menu',                    'none',     'reaches', 'public: menu list'],
    ['GET',  '/api/menu/1',                  'none',     'reaches', 'public: single menu item'],
    ['GET',  '/api/categories',              'none',     'reaches', 'public: categories'],
    ['POST', '/api/auth/login',              'none',     'reaches', 'public: staff login'],

    // protected routes with no token
    ['POST',   '/api/menu',                  'none',     'blocked', 'no token: create menu item'],
    ['PUT',    '/api/menu/1',                'none',     'blocked', 'no token: update menu item'],
    ['DELETE', '/api/menu/1',                'none',     'blocked', 'no token: delete menu item'],
    ['POST',   '/api/categories',            'none',     'blocked', 'no token: create category'],
    ['GET',    '/api/inventory',             'none',     'blocked', 'no token: read inventory'],
    ['GET',    '/api/inventory/low-stock',   'none',     'blocked', 'no token: low-stock list'],
    ['GET',    '/api/customers',             'none',     'blocked', 'no token: customer PII list'],
    ['GET',    '/api/suppliers',             'none',     'blocked', 'no token: suppliers'],
    ['GET',    '/api/payments',              'none',     'blocked', 'no token: payments'],

    // bad tokens
    ['GET', '/api/inventory', 'forged',  'blocked', 'forged signature'],
    ['GET', '/api/inventory', 'expired', 'blocked', 'expired token'],

    // correct role gets through
    ['GET',    '/api/inventory',           'staff', 'reaches', 'staff: read inventory'],
    ['GET',    '/api/inventory/low-stock', 'staff', 'reaches', 'staff: low-stock list'],
    ['GET',    '/api/customers',           'staff', 'reaches', 'staff: customer list'],
    ['GET',    '/api/payments',            'staff', 'reaches', 'staff: payments'],
    ['POST',   '/api/menu',                'admin', 'reaches', 'admin: create menu item'],
    ['DELETE', '/api/menu/999999',         'admin', 'reaches', 'admin: delete menu item'],

    // role escalation must be refused
    ['POST',   '/api/menu',           'customer', 'blocked', 'customer cannot create menu item'],
    ['GET',    '/api/inventory',      'customer', 'blocked', 'customer cannot read inventory'],
    ['GET',    '/api/customers',      'customer', 'blocked', 'customer cannot list customers'],
    ['GET',    '/api/auth/users',     'staff',    'blocked', 'staff cannot list user accounts'],
    ['POST',   '/api/auth/users',     'staff',    'blocked', 'staff cannot create user accounts'],
    ['DELETE', '/api/payments/1',     'staff',    'blocked', 'staff cannot delete a payment'],
    ['POST',   '/api/bank-accounts',  'staff',    'blocked', 'staff cannot add bank account'],

    // admin-only
    ['GET',    '/api/auth/users',         'admin', 'reaches', 'admin: list user accounts'],
    ['DELETE', '/api/payments/999999',    'admin', 'reaches', 'admin: delete payment'],
    ['PUT',    '/api/payments/1/approve', 'admin', 'reaches', 'admin: approve payment'],

    // what a customer legitimately needs
    ['GET',  '/api/bank-accounts', 'customer', 'reaches', 'customer: bank accounts for transfer'],
    ['POST', '/api/payments',      'customer', 'reaches', 'customer: submit payment'],
    ['POST', '/api/orders',        'customer', 'reaches', 'customer: create order'],
    ['GET',  '/api/orders',        'customer', 'blocked', 'customer cannot list ALL orders']
];

(async () => {
    // Give the server a moment to bind.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const failures = [];
    let pass = 0;

    console.log('\n  METHOD  PATH                             TOKEN     EXP     GOT    RESULT');
    console.log('  ' + '-'.repeat(84));

    for (const [method, path, tokenName, expectation, label] of CASES) {
        const { status, detail } = await probe(method, path, tokenName);

        const blocked = status === 401 || status === 403;
        const ok = expectation === 'blocked' ? blocked : !blocked;

        if (ok) {
            pass++;
        } else {
            failures.push({ label, method, path, tokenName, expectation, status, detail });
        }

        console.log(
            '  ' + method.padEnd(7) +
            path.padEnd(33) +
            tokenName.padEnd(10) +
            expectation.padEnd(8) +
            String(status).padEnd(7) +
            (ok ? 'PASS' : 'FAIL') + '  ' + label
        );
    }

    console.log(`\n  ${pass} passed, ${failures.length} failed\n`);

    if (failures.length > 0) {
        console.log('  FAILURES:');
        for (const f of failures) {
            console.log(`   - ${f.label}`);
            console.log(`     ${f.method} ${f.path} token=${f.tokenName} expected=${f.expectation} got=${f.status} ${f.detail}`);
        }
    }

    process.exit(failures.length > 0 ? 1 : 0);
})();
