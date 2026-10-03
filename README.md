# Restaurant Ordering and Inventory System

A full-stack restaurant ordering and stock-control system, built as a group
practical project for a System Analysis and Design course at the University of
Ibadan Distance Learning Centre.

Customers browse a menu and place orders, staff move those orders through the
kitchen, and administrators manage the menu, stock, suppliers, payments and
reporting. Stock is deducted automatically when an order is completed, based on
a recipe mapping that says what each dish consumes.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript | No build step — clone it and open it |
| Backend | Node.js + Express | REST API |
| Database | MySQL / MariaDB | Relational data with foreign keys and transactions |
| Auth | JSON Web Tokens + bcrypt | Stateless sessions, hashed passwords |

There is **no bundler, no framework and no CDN dependency**. Every icon is inline
SVG, the fonts are the system stack, and the whole frontend is served by the
Express process itself.

---

## Running it locally

You need **Node.js 18+** and a **MySQL or MariaDB server**.

### 1. Start the database

If you already run MySQL or MariaDB locally, skip this. Otherwise, on Windows
without administrator rights you can use the portable MariaDB build — see the
`windows-portable-mariadb` skill notes, or install XAMPP.

### 2. Configure

```bash
cd backend
cp .env.example .env
```

Open `.env` and set your database credentials and a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The server **refuses to start** without `JWT_SECRET`. That is deliberate — a
hardcoded fallback would make every login token forgeable.

### 3. Create the schema and sample data

```bash
npm install
npm run db:setup
```

This creates all 12 tables, loads sample menu/inventory/supplier data, and
creates one test account per role. It needs no MySQL command-line client — it
runs the SQL through the driver.

### 4. Start it

```bash
npm start
```

Open **http://localhost:3000**. That single URL serves the storefront, the admin
workspace, the staff workspace and the API.

### Test accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `manager@restaurant.test` | `manager123` |
| Administrator | `admin@restaurant.test` | `admin123` |
| Staff | `cashier@restaurant.test` | `cashier123` |
| Staff | `staff@restaurant.test` | `staff123` |
| Customer | `bola@example.com` | `bola123` |
| Customer | `ada@example.com` | `customer123` |

> Change these before putting the site anywhere public — they are in this repo.

---

## The three areas

**Storefront** (`/customer/`) — a public menu with photography and category
filtering, a cart, checkout, card or bank-transfer payment, order history and a
profile page.

**Order tracking** (`/track/`) — a public page, no account needed. Enter an order
number plus the phone or email used on the order and see its progress. The
contact is required because order numbers are sequential — without it, anyone
could read any order by counting upwards.

**Admin workspace** (`/admin/`) — menu, recipes, categories, orders, inventory,
suppliers, customers, payments, bank accounts, user accounts and reports.

**Staff workspace** (`/staff/`) — the operational subset: orders, menu, stock,
customers and payments, plus a dashboard showing what needs action.

---

## API

52 endpoints across 9 modules, all under `/api`:

| Module | Covers |
|---|---|
| `auth` | Login for staff/admin and customers, user account management |
| `menu` | Menu items, and the recipe mapping that drives stock deduction |
| `categories` | Menu groupings |
| `orders` | Order creation, lifecycle transitions, history, public tracking |
| `inventory` | Stock levels, reorder points, stock-in, low-stock alerts |
| `suppliers` | Who stock is bought from |
| `payments` | Card and bank-transfer payments, approval |
| `customers` | Customer records |
| `reports` | Sales, order and stock summaries |
| `bank-accounts` | Accounts shown to customers paying by transfer |

Access is enforced server-side: every route except a handful of public ones
requires a valid JWT, and role checks sit on top. A customer can only read their
own orders.

**Health check:** `GET /api/health`

---

## Tests

Four suites, 112 assertions, all runnable without any test framework:

```bash
npm run test:auth       # 35 — route guards, roles, tokens (works with no DB)
npm run test:workflow   # 44 — login -> order -> pay -> lifecycle -> stock
npm run test:recipe     # 19 — recipe mapping, validation, permissions
npm run test:track      # 14 — public tracking and its enumeration guard
```

The first suite needs no database at all: it asserts that a `401`/`403` means the
middleware blocked a request and anything else means it reached the handler.

---

## Deploying

See **[DEPLOY.md](./DEPLOY.md)**. Short version: the whole app runs as one free
Render web service, with a free MySQL database from Aiven — no credit card, and
no code changes.

`render.yaml` is the blueprint.

---

## Project layout

```
backend/
  config/          environment + database pool
  domain/          order lifecycle (statuses and legal transitions)
  middleware/      JWT verification and role guards
  routes/          9 route modules
  database/        schema.sql, seed.sql, setup script
  test/            4 test suites
frontend/
  css/             tokens.css + components.css (the design system)
  js/              api.js, shell.js, site-nav.js, table-tools.js, charts.js
  assets/          food photography and the favicon
  customer/        storefront, checkout, payment, orders, profile, sign-up
  admin/           the administrator workspace
  staff/           the staff workspace
  track/           public order tracking
```

---

## Notes on the design

The frontend started as 25 separate stylesheets totalling 3,751 lines with no
CSS variables, in which every screen re-declared its own colours. It is now one
token layer plus one component layer, and each screen keeps only the rules
genuinely unique to it.

Two conventions worth keeping:

- **Never hardcode a colour.** Use the custom properties in `tokens.css`.
- **No emoji as icons.** Inline SVG only — emoji render differently on every
  operating system, cannot be themed, and do not scale.
