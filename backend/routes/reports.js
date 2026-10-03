const express = require('express');

const pool = require('../config/database');
const { verifyToken, requireStaff } = require('../middleware/auth');
const { ORDER_STATUSES, REPORTABLE_STATUSES } = require('../domain/orderLifecycle');

const router = express.Router();


// ============================================================================
//  GET /api/reports/summary  —  PRD FR10
// ============================================================================
//  "The system shall generate a summary dashboard/report showing order counts,
//   sales totals, menu availability and low-stock items."
//
//  Returns everything the Reports screen needs in one request, so the page does
//  not have to fetch six collections and count them in the browser (which is
//  what the admin dashboard used to do).
//
//  Staff and administrators only.
// ============================================================================
router.get('/summary', verifyToken, requireStaff, async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        // --- 1. Order counts, per status -----------------------------------
        const statusRows = await connection.query(`
            SELECT
                status,
                COUNT(*) AS order_count
            FROM orders
            GROUP BY status
        `);

        // Start every status at 0 so the response shape is stable even when a
        // status has never been used. A dashboard should not have to guess.
        const ordersByStatus = {};
        for (const status of ORDER_STATUSES) {
            ordersByStatus[status] = 0;
        }

        let totalOrders = 0;

        for (const row of statusRows) {
            const count = Number(row.order_count);

            if (Object.prototype.hasOwnProperty.call(ordersByStatus, row.status)) {
                ordersByStatus[row.status] = count;
            }

            totalOrders += count;
        }


        // --- 2. Sales totals, from payments ---------------------------------
        const salesRows = await connection.query(`
            SELECT
                COALESCE(SUM(CASE WHEN payment_status = 'Paid'    THEN amount END), 0) AS total_collected,
                COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN amount END), 0) AS total_pending,
                COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) AS paid_payment_count,
                COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) AS pending_payment_count
            FROM payments
        `);

        const sales = salesRows[0] || {};


        // --- 3. Menu availability -------------------------------------------
        const menuRows = await connection.query(`
            SELECT
                COUNT(*) AS total_items,
                COALESCE(SUM(CASE WHEN availability = 1 THEN 1 ELSE 0 END), 0) AS available_items,
                COALESCE(SUM(CASE WHEN availability = 0 THEN 1 ELSE 0 END), 0) AS unavailable_items
            FROM menu_items
        `);

        const menu = menuRows[0] || {};


        // --- 4. Low-stock items (FR9) ---------------------------------------
        const lowStock = await connection.query(`
            SELECT
                i.inventory_id,
                i.item_name,
                i.unit,
                i.quantity_in_stock,
                i.reorder_level,
                s.supplier_name
            FROM inventory_items i
            LEFT JOIN suppliers s
                ON i.supplier_id = s.supplier_id
            WHERE i.quantity_in_stock <= i.reorder_level
            ORDER BY i.quantity_in_stock ASC
        `);


        // --- 5. Most ordered menu items -------------------------------------
        // Cancelled orders are excluded, so a cancelled order does not make an
        // item look popular or inflate its revenue.
        const placeholders = REPORTABLE_STATUSES.map(() => '?').join(', ');

        const popularItems = await connection.query(
            `SELECT
                mi.item_id,
                mi.item_name,
                SUM(oi.quantity) AS total_quantity,
                SUM(oi.subtotal) AS total_revenue
             FROM order_items oi
             JOIN menu_items mi
                ON oi.item_id = mi.item_id
             JOIN orders o
                ON oi.order_id = o.order_id
             WHERE o.status IN (${placeholders})
             GROUP BY mi.item_id, mi.item_name
             ORDER BY total_quantity DESC
             LIMIT 5`,
            REPORTABLE_STATUSES
        );


        res.json({
            orders: {
                total: totalOrders,
                by_status: ordersByStatus
            },
            sales: {
                total_collected: Number(sales.total_collected || 0),
                total_pending: Number(sales.total_pending || 0),
                paid_payment_count: Number(sales.paid_payment_count || 0),
                pending_payment_count: Number(sales.pending_payment_count || 0)
            },
            menu: {
                total_items: Number(menu.total_items || 0),
                available_items: Number(menu.available_items || 0),
                unavailable_items: Number(menu.unavailable_items || 0)
            },
            low_stock: lowStock,
            popular_items: popularItems.map((item) => ({
                item_id: item.item_id,
                item_name: item.item_name,
                total_quantity: Number(item.total_quantity || 0),
                total_revenue: Number(item.total_revenue || 0)
            }))
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Failed to build report summary'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


module.exports = router;
