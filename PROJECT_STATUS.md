# PROJECT STATUS — Restaurant Ordering and Inventory System

**Audited:** 3 October 2026
**Source of truth:** `CSC302_Group_A32_Restaurant_Ordering_and_Inventory_System-7.docx` (the PRD)
**Codebase:** `C:\Users\IFEANYI\Documents\lll\restaurant-system`
**Method:** static audit — read the PRD, read all 12 backend files, read all frontend screens + stylesheets, cross-checked every PRD requirement against actual code. The app was **not run** (no database available on this machine), so runtime behaviour below is inferred from code, not observed.

---

## 0. PHASE A — COMPLETE (3 October 2026)

The "make it run and make it honest" phase is done. What changed:

| Was | Now |
|---|---|
| `config/database.js` hardcoded a Termux/Android socket path | Reads `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` from `.env`. Optional `DB_SOCKET_PATH` still supported for the Termux workflow |
| `dotenv` in `package.json` but never required | Loaded at the top of `config/database.js` **and** `server.js` |
| `JWT_SECRET` silently fell back to a hardcoded string | Real random 32-byte secret in `.env`; `.env.example` added for reproducibility |
| `PORT` hardcoded to 3000 | `process.env.PORT` with a 3000 default |
| **No schema file at all** | `database/schema.sql` — all 12 tables, InnoDB, utf8mb4, FKs, indexes, documented delete rules |
| No sample data | `database/seed.sql` — 14 inventory items (3 deliberately low-stock), 10 menu items, full recipe mapping, 5 suppliers, 3 customers, 2 bank accounts, working logins |
| `GET /api/inventory/low-stock` unreachable | Moved above `/:id` — **verified working** |
| No 404/error handler (Express returned HTML) | JSON 404 + central error middleware |
| `npm install` then guess | `npm run db:setup` / `db:schema` / `db:seed` / `db:test` |

**New files**
- `backend/database/schema.sql`
- `backend/database/seed.sql`
- `backend/database/setup.js` (runs the SQL through the driver — no `mysql` CLI needed)
- `backend/.env.example`

**Modified files**
- `backend/config/database.js` — env-driven pool
- `backend/server.js` — dotenv, `PORT`, 404 + error handlers
- `backend/routes/inventory.js` — `/low-stock` moved above `/:id`
- `backend/package.json` — db scripts, correct `main`
- `backend/.env` — added `PORT`, `DB_PORT`, `DB_CONNECTION_LIMIT`, `JWT_SECRET`

**Verified by actually running it** (node 22, in-process probe against the live server):

```
GET /                        -> 200 {"message":"Restaurant Ordering and Inventory System API is running!"}
GET /api/inventory/low-stock -> 500 {"error":"Failed to fetch low-stock items"}   <- handler reached
GET /api/inventory/7         -> 500 {"error":"Failed to fetch inventory item"}     <- /:id still works
GET /nope                    -> 404 {"error":"Route not found"}                    <- JSON, not HTML
```

The `500`s are only because **no MariaDB/MySQL is running on this machine** — they prove the routes are
being reached and the error path returns JSON. Before the fix, `/low-stock` returned
`404 "Inventory item not found"` because `/:id` swallowed it.

**Demo logins (from the seed)**

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@restaurant.test` | `admin123` |
| Staff | `staff@restaurant.test` | `staff123` |
| Customer | `ada@example.com` | `customer123` |

**✅ Running end-to-end since Phase C.** MariaDB 11.8.9 is installed as a portable build at
`C:\Users\IFEANYI\mariadb` (see §0c). Start it with `start-mariadb.bat`, then:

```bash
cd restaurant-system/backend
npm install
npm run db:setup      # schema.sql then seed.sql
npm start             # http://localhost:3000
```

Open `frontend/index.html` in a browser and log in with the seeded accounts in §0c.

---

## 0b. PHASE B — COMPLETE (3 October 2026)

Server-side authentication. This was the only outright NFR failure (NFR2) and it is now closed.

**Before:** a JWT was issued at login and then never verified. There was no `jwt.verify` anywhere in
the backend, no middleware, and every write endpoint was public. `curl -X DELETE /api/menu/1`
worked with no login at all. The admin role check existed only in the browser.

**After:** every endpoint except five is behind `verifyToken`, with role checks on top.

**New files**
- `backend/config/env.js` — dotenv loaded exactly once; no module can read a setting before it exists
- `backend/middleware/auth.js` — `verifyToken`, `requireRole(...)`, plus pre-built `requireStaff` / `requireAdmin`
- `frontend/js/api.js` — shared fetch interceptor (see below)

**Modified**
- `backend/routes/*.js` — all 8 remaining route files guarded (51 routes total)
- `backend/routes/auth.js` — hardcoded `JWT_SECRET` fallback removed; it now throws at startup if unset
- `backend/config/database.js` — reads from `config/env.js`
- `backend/server.js` — reads `env.port`
- `frontend/**/index.html` — all **25** pages now load `js/api.js` before their own `app.js`

### The access model

| Access | Endpoints |
|---|---|
| **Public** (5) | `POST /auth/login`, `POST /auth/customer/signup`, `POST /auth/customer/login`, `GET /menu`, `GET /menu/:id`, `GET /categories`, `GET /categories/:id` |
| **Any logged-in user** | `POST /orders`, `GET /orders/:id`*, `GET /orders/customer/:customerId`*, `POST /payments`, `GET /bank-accounts`, `GET /bank-accounts/:id` |
| **Staff or admin** | All menu/category/customer/supplier/inventory writes and reads, `GET /orders`, `POST /orders/:id/process`, `PUT /payments/:id` |
| **Admin only** | All `/auth/users` CRUD, `PUT /payments/:id/approve`, `DELETE /payments/:id`, all bank-account writes |

\* Ownership-enforced: a customer may only read their **own** orders. Staff and administrators may
read any. Without this a customer could enumerate other people's orders by editing the id in the URL.

### Why a fetch interceptor instead of editing 17 files

The API now demands a token, but only 8 of 25 screens were sending one, and every screen is a
separate hand-written page with no shared include. Rather than make ~50 error-prone edits across 17
`app.js` files, `frontend/js/api.js` installs **one interceptor on `window.fetch`** that:

1. attaches `Authorization: Bearer <token>` when a token is stored
2. defines the API base URL in one place
3. on a 401 **with a token present**, clears the dead session and returns to the login page
   (a 401 on a login attempt is left alone so the page can show "wrong password")

This is the no-build-step equivalent of an axios interceptor. Existing `fetch()` calls are unchanged.
New code should use `window.api.get/post/put/del` instead, so error handling stays centralised.

### Verified — 35/35 cases pass

Tokens were minted directly with the app's own secret, because login itself needs the database.
Assertion: a `401`/`403` means the middleware **blocked** it; anything else means it **reached the
handler**. (The `500`s are the database being down, which proves the guard let the request through.)

```
GET    /api/menu                    none      reaches  500   public
POST   /api/menu                    none      blocked  401   no token
PUT    /api/menu/1                  none      blocked  401   no token
DELETE /api/menu/1                  none      blocked  401   no token
GET    /api/inventory               none      blocked  401   no token
GET    /api/inventory/low-stock     none      blocked  401   no token
GET    /api/customers               none      blocked  401   no token (PII)
GET    /api/payments                none      blocked  401   no token
GET    /api/inventory               forged    blocked  401   forged signature
GET    /api/inventory               expired   blocked  401   expired token
GET    /api/inventory               staff     reaches  500   correct role
POST   /api/menu                    admin     reaches  400   correct role
POST   /api/menu                    customer  blocked  403   role escalation refused
GET    /api/inventory               customer  blocked  403   role escalation refused
GET    /api/auth/users              staff     blocked  403   role escalation refused
DELETE /api/payments/1              staff     blocked  403   role escalation refused
POST   /api/bank-accounts           staff     blocked  403   role escalation refused
GET    /api/auth/users              admin     reaches  500   admin only
PUT    /api/payments/1/approve      admin     reaches  500   admin only
GET    /api/bank-accounts           customer  reaches  500   customer needs it to pay
POST   /api/payments                customer  reaches  400   customer pays
POST   /api/orders                  customer  reaches  400   customer orders
GET    /api/orders                  customer  blocked  403   cannot list ALL orders
...
35 passed, 0 failed
```

### Note on the interceptor

It patches `window.fetch` globally. That is a deliberate trade-off: it is the smallest correct change
for a project with 25 standalone pages and no build step. It is documented at the top of the file, and
Phase D's `api.js` step is already satisfied by it — so Phase D no longer needs its own API layer.

---

## 0c. PHASE C — COMPLETE (3 October 2026)

Closes the remaining requirement gaps, and — for the first time — the whole system runs against a
real database.

### MariaDB 11.8.9 installed (portable, no admin required)

The machine is **not elevated**, so a normal MSI/service install was impossible (UAC cannot be
answered from an automated session). Instead the official portable zip was installed:

| | |
|---|---|
| Version | MariaDB **11.8.9** (LTS line) |
| Source | `archive.mariadb.org`, SHA256 verified against the published `sha256sums.txt` |
| Location | `C:\Users\IFEANYI\mariadb` |
| Data dir | `C:\Users\IFEANYI\mariadb\data` |
| Port | 3306, root password `1234` (matches `backend/.env`) |
| Start | `C:\Users\IFEANYI\mariadb\start-mariadb.bat` |
| Stop | `C:\Users\IFEANYI\mariadb\stop-mariadb.bat` |

**Trade-off:** because it is not a Windows service, it does not start on boot. Run
`start-mariadb.bat` and leave the window open while using the app. That is the price of not having
admin rights, and it is a smaller price than rewriting the whole data layer for PostgreSQL or SQLite.

### Requirement gaps closed

**FR5 — full order lifecycle.** `POST /orders/:id/process` (which could only do `Pending → Completed`)
was replaced by `PUT /orders/:id/status`, implementing:

```
Pending ──► Preparing ──► Ready ──► Completed
   │            │           │
   └────────────┴───────────┴──────► Cancelled
```

The rules now live in **`backend/domain/orderLifecycle.js`** and nowhere else. `GET /orders/:id`
returns `allowed_next_statuses`, so the UI renders the correct buttons instead of hardcoding the
rules — the transition map cannot drift between server and client. Stock is consumed **only** on the
move to `Completed`, so cancelling never touches inventory.

**FR10 — Reports dashboard.** New `GET /api/reports/summary` returns order counts by status, sales
collected and pending, menu availability, low-stock items and most-ordered items — in one request.
New screen at `frontend/admin/reports/`. This replaces the admin dashboard's old approach of fetching
six collections and counting them in the browser.

**FR9 — low-stock now visible.** The endpoint was fixed in Phase A but nothing consumed it. It now
has a panel in the Reports screen.

**FR3 — staff can create orders.** Already possible via the API; now proven by test, and the PRD
wording is satisfied.

### Security gaps closed while testing

Two authorisation holes of the same class as the Phase B ones:

1. **A customer could create an order against any `customer_id`** by editing the request body.
   Now a customer may only order for themselves; staff may order on behalf of anyone (counter service).
2. **`dotenv` resolved `.env` from `process.cwd()`**, so the app silently loaded *no* configuration
   when started from any directory other than `backend/`. Now resolved relative to `config/env.js`.
   This was caught because the Phase B `JWT_SECRET` guard failed loudly instead of silently falling
   back to a default — exactly what that guard was added for.

### A bug this phase introduced, and the fix

Running the auth test against a live database **deleted seeded data**. Its `DELETE /api/menu/1` case
asserts "the middleware let this reach the handler" — and with a real database, it reached the handler
and deleted menu item 1. The test suite was mutating the database it was testing against.

Fixed by pointing the `reaches` cases at id `999999`. The assertion is identical (the request still
reaches the handler) but the test can no longer destroy data. Verified: menu item count is 10 before
and after.

> Worth remembering: an auth test written against a *broken* database is safe by accident, because
> everything 500s. The moment the database works, "reaches the handler" means "actually did the thing".

### Verified — 79 assertions across two suites, 0 failures

```
npm run test:auth      35 passed, 0 failed
npm run test:workflow  44 passed, 0 failed
```

The workflow suite is a real end-to-end run against MariaDB:

```
 1. Login                                   4 passed
 2. Browse the menu                         3 passed
 3. Place an order (FR3, FR4)               3 passed   total calculated server-side = 600
 4. Server-side validation guards           3 passed
 5. Payment (FR6)                           3 passed
 6. Order lifecycle (FR5)                   7 passed   incl. cannot skip Pending -> Completed
 7. Stock deduction (FR8)                   1 passed   deducted exactly 2 bottles
 8. Cancellation path                       2 passed   cancelling does NOT touch stock
 9. Low stock (FR9)                         3 passed
10. Reports (FR10)                          9 passed
11. Report access control                   2 passed
12. Order ownership                         4 passed
```

Live report output after the run:

```
Orders total      : 3
Orders by status  : {"Pending":1,"Preparing":0,"Ready":0,"Completed":1,"Cancelled":1}
Sales collected   : NGN 600
Menu items        : 10 (available 9, unavailable 1)
Low stock (3):
   Pepper (Scotch Bonnet)        6.00 kg       reorder at 8.00
   Cooking Oil                   8.00 litre    reorder at 10.00
   Chicken                      12.00 kg       reorder at 15.00
Popular items (1):
   Bottled Water              qty    5   NGN 1,500
```

### New files

- `backend/domain/orderLifecycle.js`
- `backend/routes/reports.js`
- `backend/test/workflow.test.js`
- `frontend/admin/reports/` (index.html, app.js, style.css)
- `C:\Users\IFEANYI\mariadb\start-mariadb.bat`, `stop-mariadb.bat`

### Modified

- `backend/routes/orders.js` — lifecycle endpoint, order-ownership check on creation
- `backend/routes/menu.js`, `categories.js` — unchanged this phase
- `backend/server.js` — `/api/reports` mounted
- `backend/config/env.js` — `.env` path now absolute
- `backend/test/auth.test.js` — made non-destructive
- `backend/package.json` — `test:workflow`
- `frontend/admin/orders/view/app.js` — buttons driven by `allowed_next_statuses`
- `frontend/admin/index.html` — Reports link added

---

## 0d. PHASE D — COMPLETE (3 October 2026)

The UI upgrade. This was the largest single change to the project and the one with the most visible result.

### The problem being fixed

25 stylesheets, **3,751 lines**, and **zero CSS custom properties**. Thirteen of those files re-declared
`.topbar`, every one re-declared `body`, and the page background had already drifted between `#f5f6fa`
in some files and `#f4f6f8` in others. There was no shared component layer, so every screen was its
own island — and every new screen would have been too.

### What was built

**`frontend/css/tokens.css`** — the design system's single source of truth: colours, spacing scale,
radii, type scale, shadows, motion, layout widths. Direction taken from the six references in
`designs/`, which all share one visual language the old code did not use:

| Change | Before | After |
|---|---|---|
| Page background | cool blue-grey `#f5f6fa` | **warm cream** `#FAF7F2` |
| Accent | none (a different blue per screen) | one warm orange `#E4572E` |
| Chrome | slate `#1f2937` | near-black `#14110F` |
| Font | Arial | system UI stack, no download, no CDN |
| Rounding | 5–8px, inconsistent | 8 / 12 / 16 / 22px scale |

**`frontend/css/components.css`** — one shared component layer (1,018 lines) that styles the class
vocabulary the project **already used**, so all 27 screens picked up the new design without rewriting
their markup: topbar, container, page-header, panels, cards, stat tiles, dashboard grids, tables,
forms, four button intents, status pills, messages, empty states, and the customer-facing hero /
menu-grid / cart patterns.

### The result

```
CSS:            3,751 lines  ->  2,252 lines   (-40%)
Shared layer:       0 lines  ->  1,316 lines   (tokens 298 + components 1,018)
Design tokens:      0        ->  130+ custom properties
Screens on the design system:   0 / 26  ->  27 / 27
Emoji in the UI:    6 icons  ->  0
Broken asset links: 0  ->  0 (verified)
```

Per-screen stylesheets collapsed from 84–292 lines each to 9–62, and most now hold only the handful
of rules that are genuinely unique to that screen (a table's `min-width`, a hidden form section, a
centring wrapper). Three screens ended up with **nothing but an explanatory comment** because the
shared layer covers them entirely — `staff/css/style.css`, `admin/reports/style.css`, and the
admin dashboard.

### Emoji replaced with real icons

`staff/index.html` used `📋 🍽️ 📦 👥 💳` as its dashboard icons. Emoji render differently on every OS,
cannot be themed to match the palette, and do not scale. All six are now inline SVG
(`stroke: currentColor`, `stroke-width: 1.75`), plus the `←` back-arrows on eleven admin/staff screens
and the `✓` in the "Added to Cart" button.

Verified: **zero emoji remain** anywhere in the frontend.

### New screens and features

- **`frontend/admin/recipes/`** — the recipe-mapping UI that Phase C left open. Pick a menu item,
  add/remove ingredients, set quantity per unit sold, save. It also shows, live, how many servings
  the current stock allows. This closes the FR8 fragility: previously a menu item with no mapping
  could not be ordered, and the only way to create a mapping was by hand in SQL.
- **New endpoints** in `routes/menu.js`: `GET /:id/ingredients` and `PUT /:id/ingredients`
  (staff/admin). The save is a **full replace**, which makes it idempotent and removes any chance of
  the UI's view drifting from the database.
- **`backend/database/add-test-accounts.js`** — creates one account per role. Hashes are generated at
  run time and round-trip verified before writing, because a hardcoded bcrypt hash in a `.sql` file
  can never be checked and fails later as a silent "wrong password".

### Test accounts (all verified by logging in)

| Role | Email | Password |
|---|---|---|
| Administrator | `manager@restaurant.test` | `manager123` |
| Staff | `cashier@restaurant.test` | `cashier123` |
| Customer | `bola@example.com` | `bola123` |

The original seeded accounts still work too (`admin@restaurant.test`, `staff@restaurant.test`,
`ada@example.com`). `npm run db:accounts` recreates them at any time without touching other data.

### One-click launchers

The frontend is plain static files, so "starting" it means serving a folder. Rather than have to
remember a command, three `.bat` files now exist (CRLF line endings, ASCII paths):

| File | Does |
|---|---|
| `restaurant-system/start-all.bat` | Starts all three in order: MariaDB → backend → frontend, and opens the browser |
| `restaurant-system/start-backend.bat` | Just the API on port 3000 (runs `npm install` first if `node_modules` is missing) |
| `restaurant-system/start-frontend.bat` | Just the static server on port 8080 |

Serving over `http://` rather than double-clicking `index.html` matters: browsers treat `file://`
pages as a null origin, which makes some `fetch()` calls fail in confusing ways.

### Verified — 98 assertions across three suites, 0 failures

```
npm run test:auth       35 passed, 0 failed
npm run test:workflow   44 passed, 0 failed
npm run test:recipe     19 passed, 0 failed   (new)
```

The recipe suite covers the happy path plus: non-array body, zero quantity, duplicate inventory item,
unknown inventory item, unknown menu item, empty recipe (valid — clears the mapping), customer
forbidden (403), staff allowed, and persistence confirmed by re-reading. It restores the original
recipe before exiting, so the seeded data is unchanged.

### New files

- `frontend/css/tokens.css`, `frontend/css/components.css`
- `frontend/admin/recipes/` (index.html, app.js, style.css)
- `backend/test/recipe.test.js`
- `backend/database/add-test-accounts.js`
- `restaurant-system/start-all.bat`, `start-backend.bat`, `start-frontend.bat`

### Modified

- All 27 HTML pages — load `tokens.css` → `components.css` → screen CSS, in that order
- All 25 per-screen stylesheets — reduced to screen-specific rules only
- `frontend/index.html` + `frontend/css/style.css` — login rebuilt as a branded split-screen layout
- `frontend/staff/index.html` — rebuilt with SVG icons and a Reports card
- `backend/routes/menu.js` — recipe endpoints
- `backend/package.json` — `db:accounts`, `test:recipe`; `db:setup` now also creates the test accounts

---

## 0e. CUSTOMER STOREFRONT REBUILD (3 October 2026)

The design system in Phase D made the screens *consistent*, but the customer pages were still a
list of dishes with no photography — functional, not appetising. This phase rebuilt them as an
actual restaurant storefront, modelled directly on two of the references in `designs/`.

### Reference mapping

| Reference | What was taken |
|---|---|
| **BiteHub** | Cream page, orange accent, dish cards with photos, category chips, dark footer |
| **Tasty Bites** | Dark hero with a large food photo, feature strip with icons, cream menu section below |

### Real food photography

The single biggest gap was imagery. `frontend/assets/menu/` now holds **16 photographs** (2.1 MB).

How they were sourced, in order of what actually worked:

1. ❌ `source.unsplash.com/featured/?<query>` — **dead**, returns 503
2. ❌ Scraping `unsplash.com/s/photos/<query>` — worked once, then hit an Anubis bot-challenge
   ("Making sure you're not a bot!"), so it is not dependable
3. ✅ **`images.unsplash.com/<photo-id>`** — the CDN itself is **not** bot-protected, so supplying
   ids works reliably. Used for the drinks and several dishes.
4. ✅ **TheMealDB** (`themealdb.com/api/json/v1/1/search.php?s=<term>`) — a real free API with no
   bot protection, giving named dishes with image URLs. Used for the African-style dishes.

Every image was **viewed before being assigned** — several plausible-looking ids turned out to be
cocktails, pizza or a brand-specific cola can, and were rejected. Attribution is recorded in
`frontend/assets/menu/CREDITS.txt`.

Dishes are matched to photos **by dish name, not item_id**, with a fallback to the category photo and
then the hero. Ids shift when the database is re-seeded; names do not.

### What was rebuilt

| Screen | Change |
|---|---|
| `customer/index.html` | Full storefront: announcement bar, sticky nav, dark hero with photo + floating badge, 4-item feature strip, category chips, dish cards with photos/prices/round add buttons, **sticky cart panel**, dark footer |
| `customer/checkout/` | Step indicator, details panel, sticky order summary, branded nav + footer |
| `customer/payment/` | Step indicator, order panel, dark-headed bank-transfer card with copy-to-clipboard |
| `customer/orders/` | Order cards with status + payment pills, item lists, totals, "Pay now" |
| `customer/profile/` | Profile card with initials avatar, detail rows, actions |
| `customer/signup/` | Split-screen auth shell matching the sign-in page |
| `frontend/index.html` | Sign-in moved onto the shared `.auth-shell` |

The five inner customer pages had their own `style.css` reduced to **comment-only** — everything they
need now comes from `tokens.css`, `components.css` and the shared `customer/css/style.css`.

### Three bugs found by actually looking at the pages

Screenshotting every page with Playwright (chromium is cached locally) surfaced problems that
reading the code would not have:

**1. `Cannot set properties of null` on placing an order.** `checkout/app.js` does
`document.querySelector(".customer-details").innerHTML = ...`. The rebuilt checkout used
`class="panel"` and had dropped that class, so the selector returned null and the order-confirmation
panel never rendered. Fixed by restoring the class (with a comment explaining why it must stay).

**2. The customer orders page never loaded.** `orders/app.js` called `GET /api/payments` to look up
payment status — but Phase B had locked that endpoint to staff/admin, so a customer got a 403 and
`payments.find` threw `is not a function`. This was a regression **introduced by Phase B**.

The fix was not to loosen the endpoint. `GET /api/orders/customer/:customerId` now returns a
`payment_status` per order (latest payment, via a correlated subquery), so the page makes one fewer
request and a customer still cannot read every payment in the system. Verified: a customer calling
`/api/payments` still gets **403**.

**3. Button classes did nothing on `<a>` elements.** Several buttons are anchors —
"Pay now" on the orders page, "View my orders" on the profile. The shared button rule only listed
`button, .btn`, so anchors got the colour but none of the layout: no padding, no `inline-flex`, and
an underline. They rendered as bare orange links. The base rule now lists **every** button class and
sets `text-decoration: none`, so an anchor styled as a button is indistinguishable from a real one.

### Also added

- **`frontend/assets/favicon.svg`** — a real favicon (orange rounded square, cutlery mark). The
  server log was full of `404 /favicon.ico`; every one of the 27 pages now declares the icon.
- The `.auth-shell` pattern was moved into `components.css` so the sign-in and sign-up pages share
  one implementation instead of two near-identical ones.

### Verified

```
Frontend : 27 pages · all wired to tokens + components · no broken links · no emoji
Backend  : test:auth 35 · test:workflow 44 · test:recipe 19  ->  98 passed, 0 failed
Browser  : every customer page screenshotted, console and network clean
```

Screenshotted state of the storefront: **10 dish cards, 10 photos, 0 broken images, 6 category
chips**, cart badge updating.

### Files

**New:** `frontend/assets/menu/*.jpg` (16 photos + `CREDITS.txt`), `frontend/assets/favicon.svg`

**Rebuilt:** `customer/index.html`, `customer/css/style.css`, `customer/js/app.js`, and the five
inner customer pages (HTML + `style.css`), `frontend/index.html`, `frontend/css/style.css`

**Modified:** `frontend/css/components.css` (auth shell, button base), `frontend/customer/orders/app.js`,
`frontend/customer/profile/app.js`, `backend/routes/orders.js`

---

## 0f. ADMIN/STAFF WORKSPACE + ORDER TRACKING (3 October 2026)

### The dashboard shell

Admin and staff no longer use a header bar on every page. They now share a **dark sidebar +
cream workspace** layout, which is the standard shape for a management tool and matches the dark
bands in the reference designs.

The sidebar is rendered by **`frontend/js/shell.js`** rather than being copied into 20 files. Each
page only provides `<aside class="sidebar" id="app-sidebar"></aside>`. The script:

- picks the admin or staff nav automatically from the logged-in user's role
- writes nav hrefs **relative to the frontend root** and prefixes the right number of `../` for the
  current page's depth — so one definition works from `/admin/`, `/admin/menu/` and
  `/admin/orders/view/` alike
- highlights the active item
- renders `#logout-btn` and `#admin-name`, because several existing `app.js` files look those up by
  id and would throw on null otherwise
- below 1024px turns the sidebar into an off-canvas drawer behind a `#nav-toggle` button

**Nav is role-appropriate.** Admin gets 12 destinations across 5 groups (Overview, Menu, Operations,
People, Finance). Staff gets 6 (Dashboard, Orders, Menu, Inventory, Customers, Payments).

> **Reports was removed from the staff nav.** It linked to `admin/reports/index.html`, which guards on
> `role === 'admin'` — so a staff member clicking it was silently bounced back to the sign-in page,
> i.e. the link did nothing. Reports belong to the administrator. (The *API* still allows staff to read
> the summary; if staff should see reports later, relax the guard on the page rather than re-adding a
> dead link.)

### The content, not just the chrome

Adding a sidebar alone left the pages looking the same inside, so the content itself was upgraded:

**Searchable tables.** `frontend/js/table-tools.js` injects a search box and a live row count above
any table marked `data-tools`. One script, so 14 list tables across admin and staff got it without
14 copies of the markup. Rows are hidden with a **class** rather than the `hidden` attribute —
`hidden` is unreliable on `<tr>` because the UA stylesheet's `tr { display: table-row }` competes with
`[hidden] { display: none }`. A `MutationObserver` re-applies the filter after `app.js` re-renders the
tbody on refresh.

**Real form layouts.** Forms were a single column of bare `<label>` + `<input>` pairs. Every field is
now wrapped in a `.form-group` inside a `.form-grid` — two-up for related short fields, `.span-2` for
long text — with buttons in a separate `.form-actions` bar and a `.field-hint` only where a hint
earns its place.

**Deeper dashboards.** The admin dashboard now leads with six stat tiles and a **"Needs attention"**
panel that surfaces low-stock items (FR9) directly on the landing page. The staff dashboard leads with
four live counts and an **"Orders in progress"** table — pending, preparing and ready, oldest first,
each with an Open link — because that is what a staff member actually acts on.

### Order tracking for the public (new feature)

`frontend/track/` — a page anyone can use **without an account**, for a walk-in or counter customer.

**Why it needs more than an order number.** Order ids are sequential integers, so an endpoint keyed on
the id alone would let anyone read any order by counting upwards — including other customers' names
and totals. `POST /api/orders/track` therefore requires the **order number plus the phone or email on
the order**, and treats the contact as a shared secret:

- a wrong contact and a non-existent order return the **same** 404 message, so the endpoint cannot be
  used to discover which order numbers exist
- phone comparison is digit-based, so `0803 123 4567` and `+234803…` both match `08031234567`
- the response carries the **first name only** — never the full customer record
- the endpoint is read-only: it can show status, it can never change it

The page renders a **four-stage progress timeline** (Order received → In the kitchen → Ready →
Completed), with a separate cancelled state, plus the item list and total.

Verified: **14 assertions**, covering validation, the enumeration guard, phone formatting variants,
email matching, and that no email/phone/last-name leaks in the response.

### Mobile navigation — a real bug, fixed

Below 720px the customer stylesheet hid `.nav-links` to stop the header wrapping, **and put nothing in
their place**. On a phone the storefront had *no navigation at all*. `frontend/js/site-nav.js` now
injects a hamburger into the header and drops the links down as a panel, closing on link tap, on
Escape, and when the viewport grows past the breakpoint.

Verified at 390px: **16 assertions** across the customer storefront, the admin drawer and the track
page — hamburger present, links collapsed then shown, drawer slides in with a scrim, and tracking
returns a result for a correct contact and an error (with no result) for a wrong one.

### Food photography on the auth pages

`.auth-brand` now layers a warm orange glow, a dark scrim, real food photography and a flat colour
fallback. The `url()` is relative to `components.css`, so it resolves from any page that loads it; the
sign-up page overrides it with a different dish so the two pages are not identical.

### Files

**New:** `js/shell.js`, `js/table-tools.js`, `js/site-nav.js`, `track/` (index.html, app.js, style.css)

**Modified:** all 20 admin/staff pages (shell + content), all 5 customer pages (mobile nav),
`css/components.css` (shell, content patterns, table toolbar, auth imagery, status pills),
`customer/css/style.css`, `frontend/index.html`, `css/style.css`,
`backend/routes/orders.js` (public track endpoint)

---

## 0g. DEPLOYMENT PREP (3 October 2026)

### The app is now ONE service

The Express server serves the static frontend as well as the REST API. That is a structural change
that makes hosting dramatically simpler:

| Before | After |
|---|---|
| Frontend on one host, API on another | One process serves both |
| CORS had to be configured and kept right | Requests are same-origin — CORS is not involved |
| `http://localhost:3000/api` hardcoded in 21 files | Resolved from `window.location.origin` |
| Two things to deploy, monitor and pay for | One |

`server.js` now mounts `express.static(frontend)`, adds `/api/health` for the platform's health
probe, and returns JSON 404s for unknown `/api` routes (anything else falls back to the sign-in
page, so a mistyped URL does not show a JSON blob in a browser tab).

The health check deliberately **does not touch the database**. A health probe that fails on a
momentary database blip makes the platform restart a service that was working fine.

`js/api.js` now resolves the API base as `window.location.origin + '/api'`, falling back to
`http://localhost:3000/api` only when the page is opened over `file://` (where there is no origin to
be relative to). A `window.API_BASE` override exists for a split deployment.

### The database question — and why MySQL stays

Render's free tier includes a free **Postgres**, and Render offers **no managed MySQL at all**. The
obvious "fix" would be to migrate the data layer, but that means rewriting all 51 queries across 12
files (`?` → `$n`, `AUTO_INCREMENT` → `IDENTITY`, `ENUM` → `CREATE TYPE`, `insertId` → `RETURNING`,
`affectedRows` → `rowCount`).

Two things ruled that out:

**SQLite is not an option.** Render's free web service has an *ephemeral* filesystem — every deploy,
restart, or spin-down after 15 minutes of inactivity wipes it, taking the database file with it.
Persistent disks exist but are paid-only.

**A genuinely free MySQL does exist.** Aiven's own documentation states the free MySQL tier has *no
time limit* and needs no credit card: 1 node, 1 CPU, 1 GB RAM, 1 GB disk, 76 max connections.
(Third-party sites describe it as a trial; Aiven's documentation is explicit that it is not.)

So the stack is **Render free web service + Aiven free MySQL** — no code changes, no migration, £0.

The one code change this required is `DB_SSL`, because managed MySQL providers require an encrypted
connection and a local MariaDB does not. It is opt-in rather than always-on.

### Files

**New:** `render.yaml`, `DEPLOY.md` (step-by-step Aiven + Render setup), `README.md`, `.gitignore`

**Modified:** `backend/server.js`, `backend/config/database.js` (SSL), `backend/config/env.js`
(`ALLOWED_ORIGINS`), `backend/.env.example`, `frontend/js/api.js`, 21 frontend `app.js` files

**Removed:** `start-frontend.bat` — a separate static server is now *wrong*, because the frontend
expects the API on the same origin. `start-all.bat` and `start-backend.bat` were updated; the app
now runs at **http://localhost:3000**.

### Verified

```
Backend : 112 assertions — auth 35 · workflow 44 · recipe 19 · track 14 — 0 failures
Browser : login at :3000 -> admin dashboard (12 nav links, 6 tiles, 1 chart, 3 low-stock rows)
          -> storefront (10 dishes, 10 images, 0 broken) -> public tracking (4-step timeline)
          -> no console errors
```

### Repository

Initialised at `restaurant-system/` (the repo root **is** the app), 2 commits, 144 files,
remote set to `github.com/Ifeanyi-design/resturant-website`.

**No `.env` and no `node_modules` are tracked** — verified before both commits. The database password
and JWT secret never leave the machine.

---

## 1. Verdict in one paragraph

The **backend is essentially feature-complete** against the PRD — roughly 51 endpoints across 9 modules, all 10 functional requirements implemented except one that is written but unreachable. The **frontend is also functionally complete** (25 screens, every one wired to a real endpoint) but is **visually unfinished and structurally duplicated** — 3,751 lines of CSS with zero design tokens, 23 near-copies of the same topbar/table/button rules, and no shared component layer. The single biggest problem is not missing features: it is that **there is no authentication on the server at all**, so the entire role-based access model (NFR2) is cosmetic and bypassable with one curl command. Second biggest: **there is no database schema file anywhere**, so the system cannot currently be reproduced on another machine.

| Layer | Completion | Notes |
|---|---|---|
| Backend — features | **100%** | All 10 FRs implemented and verified end-to-end against MariaDB |
| Backend — security | **~90%** | `verifyToken` + role guards across 51 routes, ownership checks; 35/35 tests pass (Phase B) |
| Backend — reproducibility | **100%** | `schema.sql` + `seed.sql` + `setup.js` + `.env.example` (done in Phase A) |
| Frontend — functionality | **100%** | 27 screens, all wired. Recipe-mapping UI added in Phase D |
| Frontend — UI/design | **~90%** | Design system built: tokens + shared components, 27/27 screens converted, CSS −40%, no emoji (Phase D) |
| Frontend — auth | **~85%** | Token attached to every request by the shared interceptor; client-side guards kept as a UX nicety |
| Course deliverable | **~85%** | PRD chapters 1–3 + 5 done; 4.2 implementation status is stale |

---

## 2. Requirement traceability (PRD §3.3)

### Functional requirements

| ID | Requirement (PRD §3.3.3) | Backend | Frontend | Status |
|---|---|---|---|---|
| FR1 | Admin/staff add, update, view menu items (name, category, price, availability) | `routes/menu.js` full CRUD + `routes/categories.js` full CRUD | `admin/menu`, `staff/menu`, `customer/` | **DONE** |
| FR2 | Add, update, view customer records | `routes/customers.js` full CRUD + `auth.js` signup/login | `admin/customers`, `staff/customers`, `customer/profile` | **DONE** |
| FR3 | Customer **or staff** creates an order of 1+ items + quantities | `orders.js` `POST /` — customer restricted to their own account, staff may order for anyone | `customer/checkout` creates orders | **DONE** — proven by test |
| FR4 | Calculate order total from items, quantities, prices | `orders.js` recomputes server-side from `menu_items.price` | — | **DONE** (correctly does *not* trust client-sent totals) |
| FR5 | Staff updates order status: Pending → Preparing → Ready → Completed/Cancelled | `orders.js` `PUT /:id/status`, rules in `domain/orderLifecycle.js` | `admin/orders/view` buttons driven by `allowed_next_statuses` | **DONE** — full lifecycle, invalid transitions rejected |
| FR6 | Record payment information for an order | `payments.js` POST/PUT/approve + `bank_accounts.js` | `customer/payment`, `admin/payments`, `staff/payments` | **DONE** (exceeds PRD — adds transfer-approval workflow) |
| FR7 | Admin add, update, view inventory incl. quantity + reorder level | `inventory.js` full CRUD + `POST /stock-in`; `suppliers.js` CRUD | `admin/inventory`, `staff/inventory` | **DONE** |
| FR8 | Deduct stock when a completed order consumes a stock item | `orders.js` `POST /:id/process` deducts via `menu_item_ingredients`, logs `stock_transactions` | — | **DONE but fragile** — needs recipe-mapping rows to exist; **no UI manages `menu_item_ingredients`**, and an unmapped item aborts the whole order with `"No inventory mapping found"` |
| FR9 | Identify inventory items at or below reorder level | `inventory.js` `GET /low-stock` | panel in `admin/reports` | **DONE** — route fixed in Phase A, panel added in Phase C |
| FR10 | Summary dashboard: order counts, sales totals, menu availability, low-stock items | `GET /api/reports/summary` (`routes/reports.js`) | `admin/reports/` screen | **DONE** — one request, all five report areas |

### Non-functional requirements

| ID | Requirement (PRD §3.3.4) | Status | Evidence |
|---|---|---|---|
| NFR1 | Acceptable response time | **Unverified** | Not measured; no load test exists |
| NFR2 | Only authenticated + authorised users can add/edit/delete protected records | **PASS** | `verifyToken` + `requireStaff`/`requireAdmin` on 51 routes; ownership checks on order reads. Verified 35/35 — see §0b |
| NFR3 | New staff user can create an order via clearly labelled forms | **Partial** | Forms are labelled, but **staff cannot create orders at all** (see FR3) |
| NFR4 | Correctly persist order + inventory records | **Partial** | Transactions used correctly in `orders.js` and `inventory.js`; but no error-handling middleware and the DB config is hardcoded |
| NFR5 | Schema supports growth without redesign | **Pass** | Normalised, sensible FKs, surrogate keys |
| NFR6 | Accessible via modern browser on desktop or mobile | **Pass (basic)** | `viewport` meta on all pages; every per-screen CSS has exactly 1 media query |

**Score: 8 of 10 FRs fully or mostly done, 1 broken, 1 partial. 1 of 6 NFRs fails outright (NFR2).**

---

## 3. PRD screen inventory vs what actually exists

PRD Table 3.12 ("Planned screen inventory", 8 screens):

| PRD screen | Exists? | Where |
|---|---|---|
| Login | Yes | `frontend/index.html` (+ role selector customer / admin-staff) |
| Customer Menu | Yes | `frontend/customer/index.html` |
| Cart / Checkout | Yes | `frontend/customer/checkout/` |
| Order Status | Yes | `frontend/customer/orders/` |
| Staff Dashboard | Yes | `frontend/staff/index.html` |
| Menu Management | Yes | `frontend/admin/menu/` |
| Inventory Management | Yes | `frontend/admin/inventory/` |
| **Reports Dashboard** | **NO** | Only a 6-count card grid on `admin/index.html` |

**Screens built beyond the PRD (11 extra):** categories, suppliers, customers, payments, bank-accounts, users, customer signup, customer profile, customer payment, admin order view, staff order view. This is scope *above* the brief — worth saying so in the write-up rather than hiding it.

**Full screen inventory — 25 screens**

- **Customer (6):** `customer/index.html` (menu + cart), `checkout`, `payment`, `orders`, `profile`, `signup`
- **Staff (6):** `staff/index.html` (dashboard), `orders`, `orders/view`, `menu`, `inventory`, `customers`, `payments`
- **Admin (10):** `admin/index.html` (dashboard), `menu`, `categories`, `orders`, `orders/view`, `inventory`, `suppliers`, `customers`, `payments`, `bank-accounts`, `users`
- **Root:** `frontend/index.html` (login)

---

## 4. Backend API inventory (~51 endpoints, 9 modules)

| Module | Mount | Endpoints |
|---|---|---|
| `auth.js` | `/api/auth` | `POST /login`, `POST /customer/signup`, `POST /customer/login`, `GET/POST /users`, `GET/PUT/DELETE /users/:id` |
| `menu.js` | `/api/menu` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `categories.js` | `/api/categories` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `orders.js` | `/api/orders` | `GET /`, `GET /customer/:customerId`, `GET /:id`, `POST /`, `POST /:id/process` |
| `inventory.js` | `/api/inventory` | `GET /`, `GET /:id`, `GET /low-stock` ⚠️, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /stock-in` |
| `suppliers.js` | `/api/suppliers` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `payments.js` | `/api/payments` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /:id/approve`, `DELETE /:id` |
| `customers.js` | `/api/customers` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `bank_accounts.js` | `/api/bank-accounts` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |

**Good things worth keeping:** every query is parameterised (no SQL injection), `orders.js` uses `beginTransaction`/`commit`/`rollback` correctly, order totals are recomputed server-side, and `/orders/:id/process` checks stock for *all* items before deducting *any* (correct all-or-nothing behaviour).

---

## 5. Blockers — fix these before anything else

### Bug #1 — `GET /api/inventory/low-stock` can never be reached (breaks FR9) — ✅ **FIXED in Phase A**

In `backend/routes/inventory.js`, `router.get('/:id')` is declared at **line 54** but `router.get('/low-stock')` is declared at **line 105**. Express matches in declaration order, so a request to `/api/inventory/low-stock` is captured by `/:id` with `id = "low-stock"`, which returns `404 { error: 'Inventory item not found' }`.

**Fix:** move the `/low-stock` handler **above** the `/:id` handler. (Same class of bug would hit `orders.js` — check any future static path is declared before `/:id`.)

### Bug #2 — the database connection ignores `.env` entirely and is hardcoded to an Android/Termux path — ✅ **FIXED in Phase A**

`backend/config/database.js`:
```js
const pool = mariadb.createPool({
    socketPath: '/data/data/com.termux/files/usr/var/run/mysqld.sock',
    user: 'root',
    database: 'restaurant_system',
    connectionLimit: 5
});
```
That socket path is a Termux-on-Android path. `backend/.env` contains `DB_HOST / DB_USER / DB_PASSWORD / DB_NAME`, but **nothing loads it**: `dotenv` is listed in `package.json` yet `require('dotenv')` appears **nowhere** in the codebase. Consequence: on this Windows machine the server starts but every DB call fails, and the credentials in `.env` are dead letters.

**Fix:** `require('dotenv').config()` at the top of `server.js`, then build the pool from `process.env` with host/port (not socketPath) as the default.

### Bug #3 — `JWT_SECRET` silently falls back to a hardcoded string — ✅ **FIXED in Phase A**

`auth.js` line 8: `const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_secret_key';` — because dotenv never runs (Bug #2), the fallback is always used. Any token is forgeable by anyone who reads the repo. Compounded by Bug #4.

### Bug #4 — no authentication on the server at all (fails NFR2) — ✅ **FIXED in Phase B**

There is **no `jwt.verify` call anywhere** and **no auth middleware**. A JWT is issued on login and stored by the frontend, but no backend route ever inspects it. The `Authorization: Bearer <token>` headers that admin screens send are **ignored** by the server.

Practical effect: `curl -X DELETE http://localhost:3000/api/menu/1` works with no login. The admin guard (`if (!token || user.role !== "admin")`) is pure client-side theatre and bypassed by `localStorage.setItem('user', '{"role":"admin"}')` in devtools.

**Fix:** add a `verifyToken` middleware that reads `Authorization`, calls `jwt.verify`, attaches `req.user`, and a `requireRole('admin')` variant; then apply them to every write route.

### Bug #5 — no database schema file exists — ✅ **FIXED in Phase A**

PRD §4.2 step 1 is *"Create the database and tables according to the 3NF relational schema."* There is **no `.sql` file, no migration, no seed** anywhere in the project. The tables only exist as SQL string literals scattered across route files. The system therefore cannot be set up on another machine, and the marker cannot verify the schema.

Tables actually referenced in code (**12**): `users`, `customers`, `categories`, `menu_items`, `orders`, `order_items`, `payments`, `inventory_items`, `stock_transactions`, `suppliers`, `menu_item_ingredients`, `restaurant_bank_accounts`.

**Fix:** write `backend/database/schema.sql` (+ `seed.sql`) with the 12 `CREATE TABLE` statements and sample data. This is a **high-value, low-effort** task and it also gives the write-up something concrete for §4.2.

### Bug #6 — PRD schema and implemented schema have drifted

| PRD §3.5.1 (3NF) | Implemented | Note |
|---|---|---|
| 8 tables | **12 tables** | Extra: `categories`, `suppliers`, `menu_item_ingredients`, `restaurant_bank_accounts` |
| `ORDER_ITEM` PK = (`OrderID`, `MenuItemID`) composite | surrogate `order_item_id` + `order_id` + `item_id` | Arguably better; **must be reconciled in the write-up** or the marker will flag it |
| `ORDER` has `StaffID` (FK) | `orders` has **no `staff_id`** — `INSERT INTO orders (customer_id, status, total_amount)` | So "which staff took this order" is unrecorded |
| `INVENTORY.MenuItemID` (stock per menu item) | `menu_item_ingredients` join table (stock per *ingredient*) | **Improvement** — real recipe mapping. Say so |
| `USER.FullName` single field | `first_name` + `last_name` split | Cosmetic; note it |
| `CUSTOMER.FullName`, no password | `first_name`, `last_name`, + `password_hash` | Customers can log in, which the PRD schema didn't anticipate |

**Fix:** update PRD §3.5.1 Table 3.11 to match reality, and add a short "deviations from the proposed design" note. Do not leave the two contradicting each other.

### Bug #7 — small but real

- `menu.js` `DELETE /:id` and `categories.js` `DELETE /:id` never check `affectedRows`, so deleting a non-existent item returns `200 success` instead of `404`. (`customers.js`, `suppliers.js`, `inventory.js`, `payments.js` do it correctly.)
- `server.js` hardcodes `const PORT = 3000` and uses a wide-open `cors()` with no origin allowlist.
- No error-handling middleware, so an unexpected throw returns Express's default HTML error page instead of JSON.
- 23 of 25 frontend JS files hardcode `http://localhost:3000/api` with no shared config module.

---

## 6. Frontend UI audit — ✅ RESOLVED in Phase D

> **This section is the pre-Phase-D audit, kept as the record of what was wrong and why.**
> Every issue it lists has been fixed — see §0d for what was actually built and the measured
> before/after. The design direction below (derived from the `designs/` references) is what the
> new token set implements.

### The structural problem (as found)

There is **no design system**. Every screen is a self-contained island:

| Issue | Measurement |
|---|---|
| CSS files | **25** (1 shared per role + 1 per screen) |
| Total CSS | **3,751 lines** |
| CSS custom properties (design tokens) | **0** — no `--color-*`, `--space-*`, `--radius-*` anywhere |
| Files redefining `.topbar` | **13 of 25** |
| Files redefining `body { margin:0; font-family:Arial; ... }` | effectively all |
| Identical (byte-for-byte) files | 0 — so it's *near*-duplication, the worst kind to maintain |
| Inconsistent backgrounds | `#f5f6fa` in some, `#f4f6f8` in others |
| Font stack | plain `Arial, sans-serif` everywhere — no type scale |
| Shared navigation | none — each page hardcodes its own header markup |
| Inline styles in HTML | 2 (`admin/inventory`, `admin/users`) — low, good |
| Hardcoded `localhost:3000` in JS | **23 files** |

The CSS is also **inconsistently formatted** — `admin/menu/style.css` puts `.topbar` at `padding: 15px 25px`, `admin/categories/style.css` uses `18px 25px`, and suppliers/customers use a `.container` wrapper the others don't have. Same design, four different implementations.

### What's actually good

- Every screen uses flex/grid (24 of 25 CSS files) — the layouts aren't table hacks.
- Every page has `viewport` meta and at least one media query — basic responsiveness exists.
- Markup is semantic-ish (`header`, `main`, `section`, `nav`) and forms use real `<label for>`.
- Almost no inline styles.

### Design direction taken from the reference images

Six references sit in `../designs/`. They are all different products but share one visual language,
and it is **not** what the code currently does.

| Reference | What it contributes |
|---|---|
| EAT UP | Warm cream sections, oversized display type, big food photography |
| Maison Saveur | Dark premium surface, serif display face, gold accent — the "fine dining" end |
| Tasty Bites | Dark hero → white body transition, rounded food cards, price + Add to Cart |
| Flavoria | Icon-in-circle feature row, orange CTA pills, star ratings |
| BiteHub | Category chips with images, "+" add button, dark promo band, 5-step "How it works" |
| Hush Modern | Alternating dark/light full-bleed sections |

**What they agree on:**

1. **Warm accent, not neutral.** Every reference uses an orange/amber primary. Current code has none.
2. **Cream page background, not cold grey.** References use `#FAF7F2`-family warm off-white.
   The code currently uses `#f5f6fa` / `#f4f6f8` — a cool blue-grey, which is the single biggest
   reason the current screens read as "generic admin template" rather than "restaurant".
3. **Near-black surfaces for hero / sidebar / footer.** `#12100F`, not the current `#1f2937` slate.
4. **Large display headings with tight leading.** Current code has no type scale at all.
5. **Cards with generous radius (12–16px)** and image-on-top food tiles.
6. **Real line icons inside circular badges** — 24×24, `stroke: currentColor`, 1.75 width.

**Point 6 matters right now:** the current staff dashboard uses emoji as icons
(`📋 🍽️ 📦 👥 💳` in `frontend/staff/index.html`). Those render differently on every OS, can't be
themed, and don't scale. They must be replaced with inline SVG. Same for any emoji elsewhere in
the markup.

**Proposed token set** (to be created as `frontend/css/tokens.css` in Phase D):

```css
:root {
  /* surfaces — warm, not grey */
  --color-bg:           #FAF7F2;
  --color-surface:      #FFFFFF;
  --color-surface-alt:  #F3EDE4;
  --color-dark:         #12100F;   /* hero, sidebar, footer */
  --color-dark-soft:    #1F1B18;

  /* text */
  --color-ink:          #1A1614;
  --color-ink-muted:    #6B625B;
  --color-ink-on-dark:  #F5F1EC;

  /* brand */
  --color-primary:      #E4572E;
  --color-primary-hover:#C7461F;
  --color-primary-soft: #FDEDE7;

  /* semantic — note: in this system, green = success, NOT "price down" */
  --color-success:      #2E7D52;
  --color-warning:      #C98A16;
  --color-danger:       #C0392B;

  --color-border:       #E7DFD5;

  /* shape */
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-pill: 999px;

  /* spacing scale */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 24px;  --space-6: 32px;  --space-7: 48px;  --space-8: 64px;

  /* type */
  --font-sans:    system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-display: "Georgia", "Times New Roman", serif;   /* free; swap for a webfont later */

  --shadow-1: 0 1px 2px rgba(26, 22, 20, 0.06);
  --shadow-2: 0 4px 12px rgba(26, 22, 20, 0.08);
}
```

Constraints this respects: no build step, no framework, no paid fonts, no CDN dependency, and it
runs fine on a weak laptop because it is still plain CSS files.

### UI upgrade plan (recommended order)

1. **Create one token layer** — `frontend/css/tokens.css` with `--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, `--color-danger`, `--color-success`, `--space-1..8`, `--radius-sm/md/lg`, `--font-sans`, `--shadow-1/2`. This alone kills most of the drift.
2. **Create one component layer** — `frontend/css/components.css` with a single canonical `.topbar`, `.btn` / `.btn-primary` / `.btn-danger`, `.card`, `.table`, `.form-field`, `.badge`, `.empty-state`, `.alert`. Then **delete the duplicated rules** from the 23 per-screen stylesheets, leaving only genuinely screen-specific rules.
3. **Add a shared nav** — one `renderNav(role)` helper (or a `frontend/js/nav.js` include) so admin/staff/customer headers stop being 10 copies of the same markup.
4. **Create one API module** — ⚠️ **half done in Phase B.** `frontend/js/api.js` now exists and
   handles the `Authorization` header and the base URL. What remains is deleting the 23 hardcoded
   `http://localhost:3000/api` constants from the individual `app.js` files and pointing them at
   `window.api.*` instead.
5. **Then restyle screen by screen** — with tokens + components in place, each screen becomes a small diff rather than a rewrite.
6. **Accessibility pass** — focus states, `aria-live` on the existing `#login-message`-style status paragraphs, `aria-label` on icon-only buttons, and check colour contrast on the `#1f2937` topbar and `#2E86C1` table headers.
7. **Empty/loading/error states** — currently "Loading..." is plain text; standardise with the `.empty-state` and `.alert` components.

> Do **not** start by restyling individual screens. Without steps 1–2 you will re-create the same duplication 25 times over.

---

## 7. Recommended order of work

**Phase A — make it run and make it honest — ✅ DONE (see section 0)**
1. ~~Add `require('dotenv').config()` and rebuild `config/database.js` from env vars~~ (Bug #2, #3)
2. ~~Write `backend/database/schema.sql` + `seed.sql` for all 12 tables~~ (Bug #5)
3. ~~Move the `/low-stock` route above `/:id`~~ (Bug #1) — verified reachable
4. ~~Add JSON 404 + error handlers so failures are parseable~~

**Phase B — security — ✅ DONE (see §0b)**
4. ~~Add `verifyToken` + `requireRole` middleware and apply to all write routes~~ (Bug #4, NFR2)
5. ~~Move `JWT_SECRET` to `.env` with no hardcoded fallback~~ — now throws at startup if unset
6. ~~Attach the token to every frontend request~~ — shared `frontend/js/api.js` interceptor, all 25 pages

**Phase C — close the requirement gaps — ✅ DONE (see §0c)**
6. ~~Implement the full order lifecycle `Pending → Preparing → Ready → Completed / Cancelled`~~ (FR5)
7. ~~Let staff create orders~~ (FR3) — was already possible via the API; now proven by test
8. ~~Build the Reports Dashboard~~ (FR10) — `/api/reports/summary` + `admin/reports/`
9. **Still open:** build a small UI for `menu_item_ingredients`, so FR8 cannot silently break when
   someone adds a menu item without a recipe mapping. Until then, a menu item with no mapping cannot
   be ordered at all.

**Phase D — UI upgrade — ✅ DONE (see §0d)**
10. ~~Create one token layer~~ — `frontend/css/tokens.css`
11. ~~Create one component layer~~ — `frontend/css/components.css`, 27/27 screens converted
12. ~~Add a shared nav~~ — the `.topbar` component is now shared by every screen
13. ~~Create one API module~~ — `frontend/js/api.js` (Phase B), still in use
14. ~~Restyle screen by screen~~ — done; per-screen CSS reduced to genuinely unique rules
15. ~~Replace emoji with real icons~~ — zero emoji remain
16. **Still open (small):** the 23 hardcoded `http://localhost:3000/api` constants in the individual
    `app.js` files. They work — the interceptor handles them — but they should point at
    `window.api` so the base URL lives in one place. Also: a staff order-creation screen (FR3 is
    satisfied by the API, but there is no staff-facing "new order" UI).

**Phase E — course deliverable**
10. Rewrite PRD §4.2 "Implementation Status and Plan" — it currently says the system has **not** been built, which is now false.
11. Update §3.5.1 Table 3.11 to match the real 12-table schema (Bug #6).
12. Fill in the §4.3 test-case table (TC01–TC08) with real results instead of "Pending".

---

## 8. Open questions

- Was the `socketPath` in `config/database.js` from developing on Android/Termux? If so, the Windows/MariaDB setup was never actually run end-to-end from this checkout.
- Is `menu_item_ingredients` populated by hand in the DB? If not, FR8 has never worked.
- Is the group submitting the *design* only (PRD as written), or design + working system? That changes how much of Phase C–D is actually required.

---

## 9. Database options — ✅ RESOLVED (3 October 2026)

**MariaDB 11.8.9 was installed** as a portable build — see §0c for how, where, and how to start it.
Option 1 below was chosen. The rest of this section is kept as the reasoning, in case the decision
ever needs revisiting.

Nothing in this project could be run end-to-end until a database existed. Three options, measured:

### Option 1 — Install MariaDB/MySQL locally (XAMPP) ⭐ recommended

| | |
|---|---|
| Code changes | **None.** The schema, the queries and PRD §4.1 all stay correct |
| Effort | ~10 minutes, one download |
| Cost | Free |
| Fits PRD? | **Yes** — §4.1 specifies MySQL. Nothing in the write-up becomes untrue |
| Weak hardware? | Fine. XAMPP's MariaDB idles at roughly 40 MB RAM |

This is the only option that requires **zero** code changes, because the project is already written
against MySQL. Everything in Phase A was built for it.

### Option 2 — Neon PostgreSQL (the database you supplied)

**Probed on 3 October 2026:**

```
CONNECTED in 2110 ms
server  : PostgreSQL 18.6
database: neondb
user    : neondb_owner
existing public tables: (none)
```

It works, it is fast enough, and it is empty — a clean slate.

| | |
|---|---|
| Code changes | **Large.** This is a different database, not a different host |
| Effort | Schema port + every query rewritten |

What "large" actually means:

| MySQL (current) | PostgreSQL (needed) |
|---|---|
| `?` placeholders | `$1, $2` positional |
| `AUTO_INCREMENT` | `GENERATED ALWAYS AS IDENTITY` |
| `ENUM('a','b')` | a `CREATE TYPE` per enum |
| `TINYINT(1)` | `BOOLEAN` |
| `CONCAT(a,' ',b)` | `\|\|` or `concat()` |
| `result.insertId` | `INSERT ... RETURNING id` |
| `result.affectedRows` | `rowCount` |
| `pool.getConnection()` / `connection.release()` | `pool.connect()` / `client.release()` |
| `connection.beginTransaction()` | `BEGIN` |

That is **12 route files, 51 queries, and a new schema file** — plus `pg` instead of `mariadb`, and
PRD §4.1 would need rewriting to say PostgreSQL. Realistically a few hours of careful work, and a
second thing to go wrong before a deadline.

**Also worth knowing:** it is a remote database, so a demo needs working internet. On a campus
network or a bad mobile connection, that is a live risk during a presentation.

### Option 3 — SQLite for local development

| | |
|---|---|
| Code changes | Moderate — schema port plus a driver adapter |
| Cost | Free, local, no internet, no install (Node 22 has `node:sqlite` built in) |
| Fits PRD? | **No** — §4.1 says MySQL, so you would be demoing a different stack |

Attractive because it is zero-install and works offline, but it still needs the same query port as
Postgres, and it makes the write-up inaccurate.

### Recommendation

**Install MariaDB via XAMPP.** It is the only path with no code changes, it keeps PRD §4.1 true, and
the project was already built for it — the original `socketPath` shows it ran fine on MariaDB under
Termux. Moving to Postgres or SQLite means rewriting the data layer of a working system to solve a
problem that a 10-minute install solves.

Keep the Neon database as a fallback, and **rotate its password** — it was pasted into a chat.
