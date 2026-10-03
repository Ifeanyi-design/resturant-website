/* ============================================================================
 *  Storefront navigation  (customer pages)
 * ============================================================================
 *  Adds the mobile menu button to the customer header.
 *
 *  Why this exists: below 720px the customer stylesheet hides `.nav-links`
 *  (Menu / My Orders / Profile) to stop the header wrapping, but nothing
 *  replaced them - so on a phone the storefront had NO navigation at all.
 *
 *  This injects a hamburger button into `.site-nav` and toggles `body.nav-open`,
 *  which the stylesheet uses to drop the links down as a panel. The button is
 *  hidden above 720px, so desktop is unaffected.
 *
 *  Loaded by the customer pages only; admin and staff use js/shell.js.
 * ========================================================================= */
(function () {
    'use strict';

    var HAMBURGER =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>';

    var CLOSE =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

    function setup() {
        var nav = document.querySelector('.site-nav');

        if (!nav) {
            return;
        }

        var links = nav.querySelector('.nav-links');

        if (!links || nav.querySelector('.nav-toggle-btn')) {
            return;
        }

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'nav-toggle-btn';
        button.setAttribute('aria-label', 'Open menu');
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = HAMBURGER;

        // Sits next to the cart pill, before it in source order so the pill
        // stays the right-most control.
        var actions = nav.querySelector('.nav-actions');

        if (actions) {
            actions.insertBefore(button, actions.firstChild);
        } else {
            nav.appendChild(button);
        }

        function setOpen(open) {
            document.body.classList.toggle('nav-open', open);
            button.setAttribute('aria-expanded', String(open));
            button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            button.innerHTML = open ? CLOSE : HAMBURGER;
        }

        button.addEventListener('click', function () {
            setOpen(!document.body.classList.contains('nav-open'));
        });

        // Tapping a link closes the panel, otherwise it stays open behind the
        // page you just navigated to.
        links.addEventListener('click', function (event) {
            if (event.target.tagName === 'A') {
                setOpen(false);
            }
        });

        // Escape closes it, for keyboard users.
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        });

        // Rotating to landscape (or resizing) past the breakpoint should not
        // leave a hidden panel state behind.
        window.addEventListener('resize', function () {
            if (window.innerWidth > 720) {
                setOpen(false);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();
