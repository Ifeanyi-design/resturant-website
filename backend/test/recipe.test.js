// ============================================================================
//  Recipe mapping test  —  npm run test:recipe
// ============================================================================
//  Covers the FR8 recipe endpoints added in Phase D, and re-checks that the
//  three seeded test accounts authenticate with the right permissions.
//
//  REQUIREMENTS: MariaDB running, and the database seeded (npm run db:setup).
//
//  This test WRITES, then restores the original recipe, so the seeded data is
//  unchanged when it finishes.
// ============================================================================
process.env.PORT = '3994';

const BASE = 'http://localhost:3994';

require('../server.js');

let pass = 0;
const fails = [];

function check(label, ok, detail) {
    if (ok) { pass++; console.log('  PASS  ' + label); }
    else { fails.push(label + (detail ? ' -> ' + detail : '')); console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}

async function api(method, path, token, body) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const r = await fetch(BASE + path, {
        method, headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* ignore */ }
    return { status: r.status, body: json, raw: text };
}

(async () => {
    await new Promise(r => setTimeout(r, 1200));

    try {
        const login = await api('POST', '/api/auth/login', null,
            { email: 'manager@restaurant.test', password: 'manager123' });

        check('new admin account can log in', login.status === 200 && !!login.body?.token,
            'status=' + login.status);

        const admin = login.body.token;

        // ---- read the seeded recipe for Jollof Rice with Chicken ----------
        const before = await api('GET', '/api/menu/1/ingredients', admin);

        check('GET recipe returns the seeded mapping',
            before.status === 200 && Array.isArray(before.body?.ingredients),
            'status=' + before.status);

        check('seeded recipe has 6 ingredients',
            before.body?.ingredients?.length === 6,
            'got ' + before.body?.ingredients?.length);

        check('recipe lines carry the inventory item name and unit',
            !!before.body.ingredients[0].inventory_item && !!before.body.ingredients[0].unit);

        const original = before.body.ingredients.map(i => ({
            inventory_id: i.inventory_id,
            quantity_required: Number(i.quantity_required)
        }));

        // ---- validation ---------------------------------------------------
        const notArray = await api('PUT', '/api/menu/1/ingredients', admin, { ingredients: 'nope' });
        check('non-array body is rejected', notArray.status === 400, 'status=' + notArray.status);

        const zeroQty = await api('PUT', '/api/menu/1/ingredients', admin,
            { ingredients: [{ inventory_id: 1, quantity_required: 0 }] });
        check('zero quantity is rejected', zeroQty.status === 400, 'status=' + zeroQty.status);

        const dupe = await api('PUT', '/api/menu/1/ingredients', admin,
            { ingredients: [
                { inventory_id: 1, quantity_required: 1 },
                { inventory_id: 1, quantity_required: 2 }
            ] });
        check('duplicate inventory item is rejected', dupe.status === 400, 'status=' + dupe.status);

        const ghost = await api('PUT', '/api/menu/1/ingredients', admin,
            { ingredients: [{ inventory_id: 999999, quantity_required: 1 }] });
        check('unknown inventory item is rejected', ghost.status === 400, 'status=' + ghost.status);

        const missingItem = await api('GET', '/api/menu/999999/ingredients', admin);
        check('unknown menu item returns 404', missingItem.status === 404, 'status=' + missingItem.status);

        // ---- role check ---------------------------------------------------
        const custLogin = await api('POST', '/api/auth/customer/login', null,
            { email: 'bola@example.com', password: 'bola123' });

        check('new customer account can log in', custLogin.status === 200 && !!custLogin.body?.token);

        const asCustomer = await api('GET', '/api/menu/1/ingredients', custLogin.body.token);
        check('customer cannot read recipes', asCustomer.status === 403, 'status=' + asCustomer.status);

        const staffLogin = await api('POST', '/api/auth/login', null,
            { email: 'cashier@restaurant.test', password: 'cashier123' });

        check('new staff account can log in', staffLogin.status === 200 && !!staffLogin.body?.token);

        const asStaff = await api('GET', '/api/menu/1/ingredients', staffLogin.body.token);
        check('staff CAN read recipes', asStaff.status === 200, 'status=' + asStaff.status);

        // ---- write, then confirm it persisted -----------------------------
        const changed = original.map(l => ({ ...l }));
        changed[0].quantity_required = 0.5;

        const save = await api('PUT', '/api/menu/1/ingredients', admin, { ingredients: changed });
        check('admin can save a recipe', save.status === 200, 'status=' + save.status + ' ' + save.raw);

        const after = await api('GET', '/api/menu/1/ingredients', admin);
        const first = after.body.ingredients.find(i => i.inventory_id === changed[0].inventory_id);

        check('the change persisted',
            Number(first.quantity_required) === 0.5,
            'got ' + first.quantity_required);

        // ---- clearing the recipe is allowed -------------------------------
        const cleared = await api('PUT', '/api/menu/1/ingredients', admin, { ingredients: [] });
        check('an empty recipe is accepted (clears the mapping)', cleared.status === 200,
            'status=' + cleared.status);

        const nowEmpty = await api('GET', '/api/menu/1/ingredients', admin);
        check('cleared recipe reads back empty', nowEmpty.body.ingredients.length === 0,
            'got ' + nowEmpty.body.ingredients.length);

        // ---- restore the seeded state -------------------------------------
        const restore = await api('PUT', '/api/menu/1/ingredients', admin, { ingredients: original });
        check('original recipe restored', restore.status === 200, 'status=' + restore.status);

        const restored = await api('GET', '/api/menu/1/ingredients', admin);
        check('restored recipe matches the seed', restored.body.ingredients.length === 6,
            'got ' + restored.body.ingredients.length);

    } catch (error) {
        console.error('  UNEXPECTED:', error.message);
        fails.push('unexpected: ' + error.message);
    }

    console.log('\n  ' + pass + ' passed, ' + fails.length + ' failed\n');
    if (fails.length) { fails.forEach(f => console.log('   - ' + f)); console.log(''); }
    process.exit(fails.length ? 1 : 0);
})();
