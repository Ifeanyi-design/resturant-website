-- ============================================================================
--  Restaurant Ordering and Inventory System
--  CSC 302 Group A32 — Database Schema
-- ============================================================================
--
--  Database : MariaDB / MySQL 5.7+ or 8.x
--  Charset  : utf8mb4 (full Unicode, including emoji in free-text fields)
--  Engine   : InnoDB (required for foreign keys and transactions)
--
--  This file is the single source of truth for the schema. Every column below
--  is referenced by name in backend/routes/*.js — if you rename a column here,
--  rename it in the route files too.
--
--  ---------------------------------------------------------------------------
--  RELATIONSHIP / DELETE RULES
--  ---------------------------------------------------------------------------
--  Two kinds of table are treated differently:
--
--   * Lookup / referenced tables  (categories, menu_items, customers, suppliers)
--     -> ON DELETE RESTRICT. The database refuses to delete a row that other
--        rows still point at. This is deliberate: deleting a category that has
--        menu items in it should fail loudly, not silently orphan them.
--
--   * Owned / derived tables      (order_items, payments, menu_item_ingredients,
--                                  stock_transactions)
--     -> ON DELETE CASCADE. These rows have no meaning without their parent,
--        so deleting the parent removes them.
--
--   * inventory_items.supplier_id -> ON DELETE SET NULL, because the inventory
--     list uses a LEFT JOIN and an item is allowed to have no supplier.
--
--  ---------------------------------------------------------------------------
--  APPLYING THIS FILE
--  ---------------------------------------------------------------------------
--  Recommended (no MySQL client needed):
--      cd backend
--      npm run db:setup          -- runs schema.sql then seed.sql
--
--  Or manually with the mysql/mariadb CLI:
--      mysql -u root -p < database/schema.sql
--      mysql -u root -p < database/seed.sql
--
--  WARNING: this script DROPS the existing tables. Do not run it against a
--  database containing data you want to keep.
-- ============================================================================


CREATE DATABASE IF NOT EXISTS restaurant_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE restaurant_system;


-- Drop in reverse dependency order so foreign keys never block the drop.
DROP TABLE IF EXISTS stock_transactions;
DROP TABLE IF EXISTS menu_item_ingredients;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS restaurant_bank_accounts;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;


-- ============================================================================
--  1. users — staff and administrator accounts (FR1, FR7, NFR2)
--     Customers are NOT stored here; see the customers table below.
-- ============================================================================
CREATE TABLE users (
    user_id       INT           NOT NULL AUTO_INCREMENT,
    first_name    VARCHAR(50)   NOT NULL,
    last_name     VARCHAR(50)   NOT NULL,
    email         VARCHAR(120)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB;


-- ============================================================================
--  2. customers — customer accounts and walk-in records (FR2, FR3)
--     password_hash is NULL for records created by staff at the counter
--     (routes/customers.js POST) and set for self-service sign-ups
--     (routes/auth.js POST /customer/signup).
-- ============================================================================
CREATE TABLE customers (
    customer_id   INT           NOT NULL AUTO_INCREMENT,
    first_name    VARCHAR(50)   NOT NULL,
    last_name     VARCHAR(50)   NOT NULL,
    phone         VARCHAR(20)   NULL,
    email         VARCHAR(120)  NULL,
    password_hash VARCHAR(255)  NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (customer_id),
    -- MySQL/MariaDB allow multiple NULLs in a UNIQUE index, so counter
    -- customers with no email address are still permitted.
    UNIQUE KEY uq_customers_email (email)
) ENGINE = InnoDB;


-- ============================================================================
--  3. categories — menu groupings (FR1)
-- ============================================================================
CREATE TABLE categories (
    category_id   INT          NOT NULL AUTO_INCREMENT,
    category_name VARCHAR(80)  NOT NULL,
    description   VARCHAR(255) NULL,

    PRIMARY KEY (category_id)
) ENGINE = InnoDB;


-- ============================================================================
--  4. suppliers — who inventory items are bought from (FR7)
-- ============================================================================
CREATE TABLE suppliers (
    supplier_id    INT          NOT NULL AUTO_INCREMENT,
    supplier_name  VARCHAR(120) NOT NULL,
    contact_person VARCHAR(100) NULL,
    phone          VARCHAR(20)  NULL,
    email          VARCHAR(120) NULL,
    address        VARCHAR(255) NULL,

    PRIMARY KEY (supplier_id)
) ENGINE = InnoDB;


-- ============================================================================
--  5. menu_items — sellable items (FR1, FR3, FR4)
--     `availability` is a 0/1 flag, not a deletion: an unavailable item still
--     appears in the menu list but cannot be ordered (see routes/orders.js).
-- ============================================================================
CREATE TABLE menu_items (
    item_id      INT            NOT NULL AUTO_INCREMENT,
    item_name    VARCHAR(120)   NOT NULL,
    category_id  INT            NOT NULL,
    price        DECIMAL(10, 2) NOT NULL,
    description  VARCHAR(255)   NULL,
    availability TINYINT(1)     NOT NULL DEFAULT 1,

    PRIMARY KEY (item_id),
    KEY idx_menu_items_category (category_id),
    CONSTRAINT fk_menu_items_category
        FOREIGN KEY (category_id) REFERENCES categories (category_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
--  6. inventory_items — raw stock the restaurant holds (FR7, FR8, FR9)
--     Reorder logic (FR9): an item is "low stock" when
--         quantity_in_stock <= reorder_level
-- ============================================================================
CREATE TABLE inventory_items (
    inventory_id      INT            NOT NULL AUTO_INCREMENT,
    item_name         VARCHAR(120)   NOT NULL,
    unit              VARCHAR(20)    NOT NULL,
    quantity_in_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    reorder_level     DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit_cost         DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    supplier_id       INT            NULL,

    PRIMARY KEY (inventory_id),
    KEY idx_inventory_supplier (supplier_id),
    CONSTRAINT fk_inventory_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
--  7. menu_item_ingredients — the recipe mapping (FR8)
--     This is what makes automatic stock deduction possible: it says how much
--     of an inventory item one unit of a menu item consumes.
--
--     NOTE: this table is NOT in PRD section 3.5.1. It is a deliberate
--     improvement over the PRD's simpler INVENTORY.MenuItemID design, because
--     a menu item is normally made from several ingredients.
--
--     If a menu item has no rows here, routes/orders.js refuses to process an
--     order containing it ("No inventory mapping found").
-- ============================================================================
CREATE TABLE menu_item_ingredients (
    ingredient_id     INT            NOT NULL AUTO_INCREMENT,
    item_id           INT            NOT NULL,
    inventory_id      INT            NOT NULL,
    quantity_required DECIMAL(10, 3) NOT NULL,

    PRIMARY KEY (ingredient_id),
    -- One row per (menu item, ingredient) pair. Without this, a duplicated
    -- mapping would deduct the same stock twice for a single order.
    UNIQUE KEY uq_recipe_pair (item_id, inventory_id),
    KEY idx_recipe_inventory (inventory_id),
    CONSTRAINT fk_recipe_menu_item
        FOREIGN KEY (item_id) REFERENCES menu_items (item_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_recipe_inventory
        FOREIGN KEY (inventory_id) REFERENCES inventory_items (inventory_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
--  8. orders — one row per customer order (FR3, FR4, FR5)
--     Status lifecycle (FR5). The full lifecycle is defined here so the
--     remaining states can be added without a schema migration, but note that
--     routes/orders.js currently only moves Pending -> Completed.
--         Pending -> Preparing -> Ready -> Completed
--         Pending -> Cancelled
--     There is no staff_id column, matching the current implementation
--     (PRD section 3.5.1 proposed one — see PROJECT_STATUS.md, issue 6).
-- ============================================================================
CREATE TABLE orders (
    order_id     INT            NOT NULL AUTO_INCREMENT,
    customer_id  INT            NOT NULL,
    order_date   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status       ENUM('Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled')
                                NOT NULL DEFAULT 'Pending',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

    PRIMARY KEY (order_id),
    KEY idx_orders_customer (customer_id),
    KEY idx_orders_status (status),
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
--  9. order_items — line items of an order (FR3, FR4)
--     unit_price is copied from menu_items.price at the time of ordering, and
--     subtotal is stored as unit_price * quantity. Both are deliberately
--     denormalised: a later menu price change must not rewrite order history.
--
--     NOTE: the PRD proposed a composite primary key (OrderID, MenuItemID).
--     A surrogate key is used instead so the same menu item can appear on two
--     separate lines (e.g. ordered, cancelled, re-added).
-- ============================================================================
CREATE TABLE order_items (
    order_item_id INT            NOT NULL AUTO_INCREMENT,
    order_id      INT            NOT NULL,
    item_id       INT            NOT NULL,
    quantity      INT            NOT NULL,
    unit_price    DECIMAL(10, 2) NOT NULL,
    subtotal      DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (order_item_id),
    KEY idx_order_items_order (order_id),
    KEY idx_order_items_item (item_id),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders (order_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_order_items_menu_item
        FOREIGN KEY (item_id) REFERENCES menu_items (item_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
-- 10. payments — payment records against an order (FR6)
--     Card   -> inserted directly as 'Paid'
--     Transfer -> inserted as 'Pending', then approved via
--                 PUT /api/payments/:id/approve
--     routes/payments.js also requires amount to equal the order total.
-- ============================================================================
CREATE TABLE payments (
    payment_id     INT            NOT NULL AUTO_INCREMENT,
    order_id       INT            NOT NULL,
    payment_method ENUM('Card', 'Transfer') NOT NULL,
    amount         DECIMAL(10, 2) NOT NULL,
    payment_status ENUM('Pending', 'Paid') NOT NULL DEFAULT 'Pending',
    payment_date   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (payment_id),
    KEY idx_payments_order (order_id),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders (order_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
-- 11. stock_transactions — audit trail of every stock movement (FR8)
--     'Purchase' is written by POST /api/inventory/stock-in.
--     'Usage'    is written by POST /api/orders/:id/process, with a negative
--                quantity, so the column sign carries the direction.
--     reference_id holds the order_id (for Usage) or supplier_id (for Purchase).
-- ============================================================================
CREATE TABLE stock_transactions (
    transaction_id   INT            NOT NULL AUTO_INCREMENT,
    inventory_id     INT            NOT NULL,
    transaction_type ENUM('Purchase', 'Usage') NOT NULL,
    quantity         DECIMAL(10, 2) NOT NULL,
    reference_id     INT            NULL,
    notes            VARCHAR(255)   NULL,
    transaction_date TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (transaction_id),
    KEY idx_stock_tx_inventory (inventory_id),
    CONSTRAINT fk_stock_tx_inventory
        FOREIGN KEY (inventory_id) REFERENCES inventory_items (inventory_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;


-- ============================================================================
-- 12. restaurant_bank_accounts — accounts shown to customers paying by
--     transfer (FR6). Not in PRD section 3.5.1; added because the transfer
--     workflow needs somewhere to publish the destination account.
-- ============================================================================
CREATE TABLE restaurant_bank_accounts (
    account_id     INT          NOT NULL AUTO_INCREMENT,
    bank_name      VARCHAR(120) NOT NULL,
    account_name   VARCHAR(120) NOT NULL,
    account_number VARCHAR(20)  NOT NULL,
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (account_id),
    UNIQUE KEY uq_bank_account_number (account_number)
) ENGINE = InnoDB;
