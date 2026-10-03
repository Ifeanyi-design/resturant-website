// Generate verified bcrypt hashes for the accounts that go into seed.sql.
// Prints SQL INSERT rows ready to paste.
const bcrypt = require('bcryptjs');

const ACCOUNTS = [
    { first: 'Ngozi', last: 'Adebayo', email: 'manager@restaurant.test', password: 'manager123' },
    { first: 'Tunde', last: 'Bakare', email: 'cashier@restaurant.test', password: 'cashier123' },
    { first: 'Bola', last: 'Adeleke', email: 'bola@example.com', password: 'bola123' }
];

(async () => {
    for (const a of ACCOUNTS) {
        const hash = await bcrypt.hash(a.password, 10);

        // Verify before printing - a seed shipping a broken hash fails later as
        // a silent "wrong password".
        const ok = await bcrypt.compare(a.password, hash);

        console.log(`-- ${a.email} / ${a.password}  (verified: ${ok})`);
        console.log(`('${a.first}', '${a.last}', '${a.email}', '${hash}', '${a.email.startsWith('bola') ? 'customer' : (a.email.startsWith('manager') ? 'admin' : 'staff')}'),`);
        console.log('');
    }
})();
