/* ============================================================================
 *  Dashboard shell  (admin + staff)
 * ============================================================================
 *  Renders the sidebar navigation for every admin and staff page, so the nav
 *  is defined ONCE instead of being repeated (with different relative paths)
 *  across 20 files.
 *
 *  Load order on a page:  api.js  ->  shell.js  ->  the page's own app.js
 *
 *  The page only needs to provide a mount point:
 *      <div id="app-sidebar"></div>
 *
 *  This script also renders #logout-btn and #admin-name, because several
 *  existing app.js files look those up by id and would throw on null if the
 *  shell did not provide them.
 *
 *  Nav hrefs below are written RELATIVE TO THE FRONTEND ROOT (e.g.
 *  "admin/menu/index.html"), and this script prefixes the correct number of
 *  "../" for whatever folder the current page lives in. That is what makes one
 *  definition work from /admin/, /admin/menu/ and /admin/orders/view/ alike.
 * ========================================================================= */
(function () {
    'use strict';

    var thisScript = document.currentScript;
    var root = thisScript
        ? thisScript.src.replace(/js\/shell\.js(\?.*)?$/, '')
        : '';

    var mount = document.getElementById('app-sidebar');
    if (!mount) {
        return;
    }

    var user = null;
    try {
        user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
        user = null;
    }

    if (!user) {
        // The page's own guard handles the redirect.
        return;
    }

    var role = user.role === 'staff' ? 'staff' : 'admin';


    /* ----------------------------------------------------------------------
     *  Icons - inline SVG, 24x24, currentColor. Never emoji.
     * ------------------------------------------------------------------- */
    var ICONS = {
        grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
        chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
        utensils: '<path d="M5 3v8a2 2 0 0 0 4 0V3"/><path d="M7 11v10"/><path d="M17 3c-1.7 1-2.5 2.8-2.5 5s.8 3.4 2.5 4v9"/>',
        book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7"/><path d="M8 11h5"/>',
        tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4.8a2 2 0 0 1 2-2H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
        receipt: '<path d="M9 3h6l1 3H8l1-3z"/><path d="M4 7h16l-1.2 12.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 7z"/><path d="M9 12h6"/>',
        box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
        truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
        users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 3.6a4 4 0 0 1 0 7.75"/>',
        card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 14.5h3"/>',
        bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v9"/><path d="M19 10v9"/><path d="M3 21h18"/><path d="M9 19v-5"/><path d="M15 19v-5"/>',
        shield: '<path d="M12 3l7 3.5v5c0 4.2-2.9 8-7 9.5-4.1-1.5-7-5.3-7-9.5v-5z"/><path d="M9 12l2 2 4-4"/>',
        logout: '<path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>'
    };

    function icon(name) {
        return '<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ' +
            'stroke-linejoin="round">' + (ICONS[name] || ICONS.grid) + '</svg></span>';
    }


    /* ----------------------------------------------------------------------
     *  Navigation, per role. hrefs are relative to the frontend root.
     * ------------------------------------------------------------------- */
    var NAV = {
        admin: [
            { group: 'Overview', items: [
                { label: 'Dashboard', href: 'admin/index.html', icon: 'grid' },
                { label: 'Reports', href: 'admin/reports/index.html', icon: 'chart' }
            ] },
            { group: 'Menu', items: [
                { label: 'Menu items', href: 'admin/menu/index.html', icon: 'utensils' },
                { label: 'Recipes', href: 'admin/recipes/index.html', icon: 'book' },
                { label: 'Categories', href: 'admin/categories/index.html', icon: 'tag' }
            ] },
            { group: 'Operations', items: [
                { label: 'Orders', href: 'admin/orders/index.html', icon: 'receipt' },
                { label: 'Inventory', href: 'admin/inventory/index.html', icon: 'box' },
                { label: 'Suppliers', href: 'admin/suppliers/index.html', icon: 'truck' }
            ] },
            { group: 'People', items: [
                { label: 'Customers', href: 'admin/customers/index.html', icon: 'users' },
                { label: 'User accounts', href: 'admin/users/index.html', icon: 'shield' }
            ] },
            { group: 'Finance', items: [
                { label: 'Payments', href: 'admin/payments/index.html', icon: 'card' },
                { label: 'Bank accounts', href: 'admin/bank-accounts/index.html', icon: 'bank' }
            ] }
        ],
        staff: [
            { group: 'Overview', items: [
                { label: 'Dashboard', href: 'staff/index.html', icon: 'grid' }
            ] },
            { group: 'Operations', items: [
                { label: 'Orders', href: 'staff/orders/index.html', icon: 'receipt' },
                { label: 'Menu', href: 'staff/menu/index.html', icon: 'utensils' },
                { label: 'Inventory', href: 'staff/inventory/index.html', icon: 'box' }
            ] },
            { group: 'People', items: [
                { label: 'Customers', href: 'staff/customers/index.html', icon: 'users' }
            ] },
            { group: 'Finance', items: [
                { label: 'Payments', href: 'staff/payments/index.html', icon: 'card' }
            ] }
            // Reports is deliberately NOT here. admin/reports/index.html guards on
            // role === 'admin', so a staff member clicking it was silently bounced
            // back to the sign-in page. Reports belong to the administrator.
        ]
    };


    /* ----------------------------------------------------------------------
     *  Work out where we are, so the active item can be highlighted and the
     *  hrefs can be rewritten with the right number of "../".
     * ------------------------------------------------------------------- */
    var rootPath = new URL(root, window.location.href).pathname;
    var current = window.location.pathname.slice(rootPath.length);

    // depth of the current page below the frontend root, e.g.
    //   "admin/menu/index.html" -> 2  ->  prefix "../../"
    var depth = current.split('/').length - 1;
    var prefix = new Array(depth + 1).join('../');

    function isActive(href) {
        return href === current;
    }


    /* ----------------------------------------------------------------------
     *  Render
     * ------------------------------------------------------------------- */
    var groups = NAV[role] || NAV.admin;

    var navHTML = groups.map(function (group) {
        return '<p class="sidebar-group">' + group.group + '</p>' +
            group.items.map(function (item) {
                return '<a class="sidebar-link' + (isActive(item.href) ? ' active' : '') +
                    '" href="' + prefix + item.href + '"' +
                    (isActive(item.href) ? ' aria-current="page"' : '') + '>' +
                    icon(item.icon) + '<span>' + item.label + '</span></a>';
            }).join('');
    }).join('');

    mount.innerHTML =
        '<div class="sidebar-brand">' +
            '<span class="brand-mark" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
                'stroke-linecap="round" stroke-linejoin="round">' + ICONS.utensils + '</svg>' +
            '</span>' +
            '<span class="brand-text">' +
                '<strong>UI Restaurant</strong>' +
                '<small>' + (role === 'admin' ? 'Administration' : 'Staff workspace') + '</small>' +
            '</span>' +
        '</div>' +

        '<nav class="sidebar-nav">' + navHTML + '</nav>' +

        '<div class="sidebar-foot">' +
            '<div class="sidebar-user">' +
                '<span class="sidebar-avatar" aria-hidden="true">' +
                    ((user.first_name || '?')[0] || '?').toUpperCase() +
                '</span>' +
                '<span class="sidebar-user-text">' +
                    '<strong id="admin-name">' + user.first_name + ' ' + user.last_name + '</strong>' +
                    '<small>' + (role === 'admin' ? 'Administrator' : 'Staff') + '</small>' +
                '</span>' +
            '</div>' +
            '<button type="button" id="logout-btn" class="sidebar-logout">' +
                icon('logout') + '<span>Log out</span>' +
            '</button>' +
        '</div>';


    /* ----------------------------------------------------------------------
     *  Behaviour
     * ------------------------------------------------------------------- */
    var logoutBtn = document.getElementById('logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('cart');
            window.location.href = root + 'index.html';
        });
    }

    // Mobile: a button in the page header toggles the sidebar in and out.
    var toggle = document.getElementById('nav-toggle');

    if (toggle) {
        toggle.addEventListener('click', function () {
            document.body.classList.toggle('nav-open');
        });
    }

    // The page's own app.js may also bind #logout-btn. That is harmless - both
    // handlers clear the same keys and navigate to the same place.
})();
