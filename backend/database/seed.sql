-- ============================================================================
--  Restaurant Ordering and Inventory System
--  CSC 302 Group A32 — Sample / Seed Data
-- ============================================================================
--
--  Run AFTER schema.sql:
--      cd backend
--      npm run db:setup        -- schema.sql then seed.sql
--   or
--      mysql -u root -p < database/seed.sql
--
--  ---------------------------------------------------------------------------
--  DEMO LOGINS  (password hashes below were generated with bcryptjs, cost 10,
--  and round-trip verified against the plaintext before being written here)
--  ---------------------------------------------------------------------------
--      Administrator : admin@restaurant.test  /  admin123
--      Staff         : staff@restaurant.test  /  staff123
--      Customer      : ada@example.com        /  customer123
--      Customer      : chidi@example.com      /  customer123
--
--  Change these before any real deployment.
--
--  ---------------------------------------------------------------------------
--  WHAT IS SEEDED, AND WHY
--  ---------------------------------------------------------------------------
--  * 14 inventory items, THREE of which are deliberately at or below their
--    reorder level. This makes FR9 (low-stock detection) demonstrable the
--    moment the app starts, without anyone having to edit stock by hand.
--  * Every menu item has a recipe mapping in menu_item_ingredients, so FR8
--    (automatic stock deduction on order completion) works for all of them.
--    A menu item with no recipe mapping cannot be ordered — see the guard in
--    routes/orders.js ("No inventory mapping found").
--  * orders / order_items / payments are left EMPTY on purpose. Create them
--    through the app so the order -> payment -> process flow is exercised
--    end to end rather than reading pre-baked rows.
--
--  Currency: amounts are in Nigerian Naira (NGN).
-- ============================================================================

USE restaurant_system;


-- ============================================================================
--  RESET  — makes this file safe to run more than once
-- ============================================================================
--  The recipe mapping below refers to menu items and inventory items by their
--  literal IDs (item_id 1..10, inventory_id 1..14). If AUTO_INCREMENT were left
--  where it stopped, a second run would insert item_id 11..20 and every recipe
--  row would point at the wrong item. So: clear the tables in child-first order
--  and rewind every AUTO_INCREMENT to 1.
--
--  This means `npm run db:seed` is destructive and repeatable, which is what
--  you want for a demo database.
-- ============================================================================
DELETE FROM stock_transactions;
DELETE FROM menu_item_ingredients;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM inventory_items;
DELETE FROM menu_items;
DELETE FROM categories;
DELETE FROM suppliers;
DELETE FROM restaurant_bank_accounts;
DELETE FROM customers;
DELETE FROM users;

ALTER TABLE users                    AUTO_INCREMENT = 1;
ALTER TABLE customers                AUTO_INCREMENT = 1;
ALTER TABLE categories               AUTO_INCREMENT = 1;
ALTER TABLE suppliers                AUTO_INCREMENT = 1;
ALTER TABLE menu_items               AUTO_INCREMENT = 1;
ALTER TABLE inventory_items          AUTO_INCREMENT = 1;
ALTER TABLE menu_item_ingredients    AUTO_INCREMENT = 1;
ALTER TABLE orders                   AUTO_INCREMENT = 1;
ALTER TABLE order_items              AUTO_INCREMENT = 1;
ALTER TABLE payments                 AUTO_INCREMENT = 1;
ALTER TABLE stock_transactions       AUTO_INCREMENT = 1;
ALTER TABLE restaurant_bank_accounts AUTO_INCREMENT = 1;


-- ============================================================================
--  USERS  (administrators and staff)
-- ============================================================================
INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES
('System',  'Administrator', 'admin@restaurant.test',   '$2b$10$TBwS3N4ULAklXHmW1LsvfuwF4Obgzd6BNSvnDdQCz3HWdPrYOyhVi', 'admin'),
('Blessing','Adeyemi',       'staff@restaurant.test',   '$2b$10$JrhTxJH5jiLseeWoAv.VKO6GuSHhOfv7/b4fehNuAvuoCYTOvwJ/C', 'staff'),
-- These three are also created by database/add-test-accounts.js. They are
-- duplicated here on purpose, so that a single `npm run db:setup:remote`
-- produces a fully usable database in one command.
('Ngozi',   'Adebayo',       'manager@restaurant.test', '$2b$10$mpakl7C7b1UruSKRhhTOyOlA175hylOBcG6g5kBbS7Vy5.63bM1ki', 'admin'),
('Tunde',   'Bakare',        'cashier@restaurant.test', '$2b$10$Ln2fexKD/pbRU8BqY63jiealyHCeo8BbLZBUdLCXNHCyQ.HTJQQUC', 'staff');


-- ============================================================================
--  CUSTOMERS
--  The third row is a counter/walk-in customer: no email, no password, so it
--  can never log in. This is valid — customers.email is UNIQUE but NULLable.
-- ============================================================================
INSERT INTO customers (first_name, last_name, phone, email, password_hash) VALUES
('Ada',   'Okafor',  '08031234567', 'ada@example.com',   '$2b$10$fb5j7r6UWugZ6xCqFkrBA.8LjcxRmhDohxRTbfE/olN.XtfXW61ve'),
('Chidi', 'Balogun', '08087654321', 'chidi@example.com', '$2b$10$fb5j7r6UWugZ6xCqFkrBA.8LjcxRmhDohxRTbfE/olN.XtfXW61ve'),
('Bola',  'Adeleke', '08055667788', 'bola@example.com',  '$2b$10$YU1FutDIYmSauOee2zW.4.RoIIGes3RXtkiiBJOTcTz1lN.iSQl9m'),
('Ngozi', 'Eze',     '07011223344', NULL,                NULL);


-- ============================================================================
--  CATEGORIES
-- ============================================================================
INSERT INTO categories (category_name, description) VALUES
('Rice Dishes',      'Rice-based main meals served with protein'),
('Noodles & Pasta',  'Spaghetti, noodles and pasta dishes'),
('Grills & Proteins', 'Grilled and peppered meat and chicken'),
('Sides',            'Small accompaniments to a main meal'),
('Drinks',           'Bottled water, soft drinks and juices');


-- ============================================================================
--  SUPPLIERS
-- ============================================================================
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES
('Bodija Market Fresh Produce', 'Alhaji Musa Bello',  '08033445566', 'sales@bodijafresh.test',  'Bodija Market, Ibadan, Oyo State'),
('Ibadan Wholesale Foods Ltd',  'Mrs. Funke Ojo',     '08122334455', 'orders@ibwholesale.test', 'Ring Road, Ibadan, Oyo State'),
('Dugbe Meat & Poultry',        'Mr. Emeka Nwosu',    '07099887766', 'supply@dugbemeat.test',   'Dugbe Market, Ibadan, Oyo State');


-- ============================================================================
--  INVENTORY ITEMS
--  Reorder rule (FR9): quantity_in_stock <= reorder_level  =>  low stock.
--  Rows marked [LOW] below are seeded at or under their reorder level.
-- ============================================================================
INSERT INTO inventory_items (item_name, unit, quantity_in_stock, reorder_level, unit_cost, supplier_id) VALUES
('Rice',                    'kg',      50.00, 20.00,  1.20, 1),
('Chicken',                 'kg',      12.00, 15.00,  4.50, 1),   -- [LOW]  12 <= 15
('Beef',                    'kg',      18.00, 10.00,  5.20, 3),
('Spaghetti',               'kg',      40.00, 15.00,  1.50, 2),
('Tomatoes',                'kg',      25.00, 10.00,  1.10, 1),
('Onions',                  'kg',      30.00, 10.00,  0.90, 1),
('Pepper (Scotch Bonnet)',  'kg',       6.00,  8.00,  3.40, 1),   -- [LOW]   6 <= 8
('Cooking Oil',             'litre',    8.00, 10.00,  2.80, 2),   -- [LOW]   8 <= 10
('Beans',                   'kg',      22.00, 10.00,  1.80, 2),
('Cabbage',                 'kg',      14.00,  6.00,  1.30, 1),
('Carrots',                 'kg',       9.00,  5.00,  1.40, 1),
('Bottled Water (75cl)',    'bottle', 120.00, 48.00,  0.60, 2),
('Soft Drink (50cl)',       'bottle',  96.00, 48.00,  0.75, 2),
('Fruit Juice (1L)',        'bottle',  24.00, 12.00,  1.60, 2);


-- ============================================================================
--  MENU ITEMS
--  availability = 1 for all except item 10, which is seeded as unavailable so
--  FR1 and the order-validation guard in routes/orders.js can both be shown.
-- ============================================================================
INSERT INTO menu_items (item_name, category_id, price, description, availability) VALUES
('Jollof Rice with Chicken', 1, 2500.00, 'Smoky party jollof rice served with a piece of chicken', 1),
('Fried Rice with Beef',     1, 2800.00, 'Fried rice with mixed vegetables and beef strips',        1),
('Spaghetti Bolognese',      2, 2200.00, 'Spaghetti in a rich tomato and minced beef sauce',        1),
('Peppered Chicken',         3, 3000.00, 'Grilled chicken finished in a spicy pepper sauce',        1),
('Grilled Beef Suya',        3, 3500.00, 'Skewered beef with suya spice and fresh onions',          1),
('Moi Moi',                  4,  800.00, 'Steamed bean pudding',                                   1),
('Coleslaw',                 4,  700.00, 'Shredded cabbage and carrots in a light dressing',        1),
('Bottled Water',            5,  300.00, 'Chilled 75cl bottled water',                              1),
('Soft Drink',               5,  400.00, 'Chilled 50cl carbonated soft drink',                      1),
('Fruit Juice',              5,  900.00, 'Chilled 1 litre fruit juice',                             0);  -- unavailable on purpose


-- ============================================================================
--  MENU ITEM INGREDIENTS  (the recipe mapping that drives FR8)
--  quantity_required is expressed in the unit of the linked inventory item.
-- ============================================================================
INSERT INTO menu_item_ingredients (item_id, inventory_id, quantity_required) VALUES
-- 1. Jollof Rice with Chicken
(1,  1, 0.250),   -- Rice
(1,  5, 0.100),   -- Tomatoes
(1,  6, 0.050),   -- Onions
(1,  7, 0.020),   -- Pepper
(1,  8, 0.050),   -- Cooking Oil
(1,  2, 0.250),   -- Chicken
-- 2. Fried Rice with Beef
(2,  1, 0.250),
(2,  5, 0.080),
(2,  6, 0.050),
(2,  8, 0.050),
(2,  3, 0.200),   -- Beef
-- 3. Spaghetti Bolognese
(3,  4, 0.200),   -- Spaghetti
(3,  5, 0.120),
(3,  6, 0.040),
(3,  3, 0.150),
(3,  8, 0.030),
-- 4. Peppered Chicken
(4,  2, 0.300),
(4,  7, 0.040),
(4,  6, 0.030),
(4,  8, 0.040),
-- 5. Grilled Beef Suya
(5,  3, 0.300),
(5,  7, 0.030),
(5,  6, 0.020),
-- 6. Moi Moi
(6,  9, 0.150),   -- Beans
(6,  7, 0.010),
(6,  6, 0.020),
(6,  8, 0.020),
-- 7. Coleslaw
(7, 10, 0.150),   -- Cabbage
(7, 11, 0.080),   -- Carrots
-- 8. Bottled Water  (resold as-is: one bottle consumes one bottle)
(8, 12, 1.000),
-- 9. Soft Drink
(9, 13, 1.000),
-- 10. Fruit Juice
(10, 14, 1.000);


-- ============================================================================
--  RESTAURANT BANK ACCOUNTS  (destination accounts for transfer payments, FR6)
-- ============================================================================
INSERT INTO restaurant_bank_accounts (bank_name, account_name, account_number, is_active) VALUES
('First Bank of Nigeria', 'University of Ibadan Restaurant', '3011234567', 1),
('Guaranty Trust Bank',   'UI Restaurant Ventures',         '0123456789', 1);
