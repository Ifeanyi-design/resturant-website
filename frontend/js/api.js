/* ============================================================================
 *  Shared frontend API layer
 * ============================================================================
 *  Loaded by EVERY page, before that page's own app.js.
 *
 *  WHY THIS FILE EXISTS
 *  --------------------
 *  The API now requires a JWT on almost every endpoint (see
 *  backend/middleware/auth.js). Only 8 of the 25 screens were sending an
 *  Authorization header, and each screen is a separate hand-written page with
 *  its own app.js and no shared include. Editing 17 app.js files to add a
 *  header would be slow and easy to get wrong.
 *
 *  So instead this file installs one interceptor on window.fetch. Every
 *  existing fetch() call in the project keeps working unchanged and
 *  automatically gains:
 *
 *    1. the Authorization header, when a token is stored
 *    2. a single place where the API base URL is defined
 *    3. a 401 handler that clears the dead session and returns to the login page
 *
 *  This is the no-build-step equivalent of an axios interceptor. New code
 *  written in later phases should use window.api.* below rather than raw
 *  fetch, so error handling stays in one place.
 * ========================================================================= */
(function () {
    'use strict';

    // document.currentScript is only valid while this file is executing
    // synchronously, so capture it now — inside a callback it would be null.
    var thisScript = document.currentScript;
    var frontendRoot = thisScript
        ? thisScript.src.replace(/js\/api\.js(\?.*)?$/, '')
        : '';

    // Where the API lives.
    //
    // In production the Express server serves this frontend, so the API is
    // same-origin at /api and no hostname needs to be baked in. That is what
    // makes one build work on localhost, on Render, and behind any domain.
    //
    // Override with `window.API_BASE = '...'` before this script loads if the
    // frontend is ever hosted separately from the API.
    var API_BASE = window.API_BASE || (
        window.location.protocol === 'file:'
            // Opened straight off disk: there is no origin to be relative to.
            ? 'http://localhost:3000/api'
            : window.location.origin + '/api'
    );
    var LOGIN_URL = frontendRoot + 'index.html';

    var nativeFetch = window.fetch.bind(window);

    function getToken() {
        try {
            return localStorage.getItem('token');
        } catch (error) {
            // Private-browsing modes can throw on localStorage access.
            return null;
        }
    }

    function clearSession() {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('customer');
            localStorage.removeItem('customer_id');
            localStorage.removeItem('cart');
        } catch (error) {
            // Nothing useful to do — the redirect below still runs.
        }
    }

    function isLoginAttempt(url) {
        return url.indexOf('/auth/login') !== -1 ||
               url.indexOf('/auth/customer/login') !== -1;
    }

    // '/api/menu' -> '<base>/menu', where <base> is resolved above.
    function resolveUrl(url) {
        if (url.charAt(0) !== '/') {
            return url;
        }
        return API_BASE + url.slice('/api'.length);
    }

    window.fetch = function (input, init) {
        var url = typeof input === 'string'
            ? input
            : (input && input.url) || '';

        var options = init ? Object.assign({}, init) : {};

        var resolved = resolveUrl(url);

        if (resolved !== url) {
            input = resolved;
            url = resolved;
        }

        var token = getToken();

        if (token) {
            var headers = new Headers(options.headers || {});

            if (!headers.has('Authorization')) {
                headers.set('Authorization', 'Bearer ' + token);
            }

            options.headers = headers;
        }

        return nativeFetch(input, options).then(function (response) {

            // A 401 while a token WAS stored means the session died (expired or
            // the secret was rotated). Clear it and send the user back to the
            // login page, rather than leaving every screen silently empty.
            // A 401 with no token, or on a login attempt, is a normal wrong
            // password and must be left for the page to display.
            if (response.status === 401 && token && !isLoginAttempt(url)) {
                clearSession();

                var alreadyThere =
                    new URL(LOGIN_URL, window.location.href).href ===
                    window.location.href;

                if (!alreadyThere) {
                    window.location.href = LOGIN_URL;
                }
            }

            return response;
        });
    };


    /* ------------------------------------------------------------------------
     *  Explicit helpers for code written from here on.
     *  window.api.get('/api/menu') reads better than a raw fetch plus a manual
     *  response.ok check repeated on every screen.
     * --------------------------------------------------------------------- */
    window.api = {
        base: API_BASE,

        getToken: getToken,
        clearSession: clearSession,

        request: function (path, options) {
            return window.fetch(resolveUrl(path), options).then(function (response) {
                if (!response.ok) {
                    return response.json()
                        .catch(function () {
                            return { error: 'Request failed (' + response.status + ')' };
                        })
                        .then(function (body) {
                            var error = new Error(body.error || body.message || 'Request failed');
                            error.status = response.status;
                            error.body = body;
                            throw error;
                        });
                }

                return response.status === 204 ? null : response.json();
            });
        },

        get: function (path) {
            return window.api.request(path);
        },

        post: function (path, body) {
            return window.api.request(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },

        put: function (path, body) {
            return window.api.request(path, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },

        del: function (path) {
            return window.api.request(path, { method: 'DELETE' });
        },

        logout: function () {
            clearSession();
            window.location.href = LOGIN_URL;
        }
    };
})();
