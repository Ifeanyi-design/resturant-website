// ============================================================================
//  Reports dashboard  —  PRD FR10
// ============================================================================
//  Reads everything from a single endpoint, GET /api/reports/summary.
//  window.api is provided by ../../js/api.js, which also attaches the JWT.
// ============================================================================

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
    window.location.href = "../../index.html";
}

const messageBox = document.getElementById("message");

const refreshBtn = document.getElementById("refresh-btn");

const statOrders = document.getElementById("stat-orders");
const statCompleted = document.getElementById("stat-completed");
const statCollected = document.getElementById("stat-collected");
const statPending = document.getElementById("stat-pending");

const statusList = document.getElementById("status-list");
const menuList = document.getElementById("menu-list");
const lowStockBody = document.getElementById("low-stock-body");
const popularBody = document.getElementById("popular-body");


// The order lifecycle, in display order. Keep in step with
// backend/domain/orderLifecycle.js.
const STATUS_ORDER = ["Pending", "Preparing", "Ready", "Completed", "Cancelled"];


function money(value) {
    return `₦${Number(value || 0).toLocaleString()}`;
}


function showError(text) {
    messageBox.innerHTML = `<div class="error">${text}</div>`;
}


function clearMessage() {
    messageBox.innerHTML = "";
}


// ========================================
// RENDER
// ========================================

function renderStats(data) {

    statOrders.textContent =
        data.orders.total.toLocaleString();

    statCompleted.textContent =
        (data.orders.by_status.Completed || 0).toLocaleString();

    statCollected.textContent =
        money(data.sales.total_collected);

    // Show the amount awaiting approval, and how many payments it covers.
    statPending.textContent =
        data.sales.pending_payment_count > 0
            ? `${money(data.sales.total_pending)} (${data.sales.pending_payment_count})`
            : money(0);
}


function renderStatuses(data) {

    statusList.innerHTML = STATUS_ORDER
        .map(status => {

            const count = data.orders.by_status[status] || 0;

            return `
                <li>
                    <span class="status ${status.toLowerCase()}">${status}</span>
                    <span class="count">${count}</span>
                </li>
            `;
        })
        .join("");
}


function renderMenu(data) {

    const { total_items, available_items, unavailable_items } = data.menu;

    menuList.innerHTML = `
        <li>
            <span>Total menu items</span>
            <span class="count">${total_items}</span>
        </li>
        <li>
            <span class="status available">Available</span>
            <span class="count">${available_items}</span>
        </li>
        <li>
            <span class="status unavailable">Unavailable</span>
            <span class="count">${unavailable_items}</span>
        </li>
    `;
}


function renderLowStock(items) {

    if (items.length === 0) {
        lowStockBody.innerHTML = `
            <tr>
                <td colspan="5" class="muted">
                    No items are at or below their reorder level.
                </td>
            </tr>
        `;
        return;
    }

    lowStockBody.innerHTML = items
        .map(item => `
            <tr>
                <td>${item.item_name}</td>
                <td>
                    <span class="status low">
                        ${Number(item.quantity_in_stock)}
                    </span>
                </td>
                <td>${Number(item.reorder_level)}</td>
                <td>${item.unit}</td>
                <td>${item.supplier_name || "—"}</td>
            </tr>
        `)
        .join("");
}


function renderPopular(items) {

    if (items.length === 0) {
        popularBody.innerHTML = `
            <tr>
                <td colspan="4" class="muted">
                    No orders have been placed yet.
                </td>
            </tr>
        `;
        return;
    }

    popularBody.innerHTML = items
        .map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.item_name}</td>
                <td>${item.total_quantity}</td>
                <td>${money(item.total_revenue)}</td>
            </tr>
        `)
        .join("");
}


// ========================================
// BEST SELLERS CHART
// ========================================
// Rendered with the shared inline-SVG helper in ../../js/charts.js.
// The table below it carries revenue; the bars make the ranking obvious at a
// glance, which is the whole point of a report.

function renderPopularChart(items) {

    const container = document.getElementById("popular-chart");

    if (!container || !window.charts) {
        return;
    }

    window.charts.bars(
        container,
        items.map(item => ({
            label: item.item_name,
            value: item.total_quantity
        })),
        {
            format: value => value + " sold"
        }
    );
}


// ========================================
// LOAD
// ========================================

async function loadReport() {

    refreshBtn.disabled = true;
    refreshBtn.textContent = "Loading...";

    clearMessage();

    try {

        const data = await window.api.get("/api/reports/summary");

        renderStats(data);
        renderStatuses(data);
        renderMenu(data);
        renderLowStock(data.low_stock);
        renderPopular(data.popular_items);
        renderPopularChart(data.popular_items);

    } catch (error) {

        console.error(error);

        showError(
            error.message || "Failed to load the report."
        );

    } finally {

        refreshBtn.disabled = false;
        refreshBtn.textContent = "Refresh";
    }
}


refreshBtn.addEventListener("click", loadReport);

loadReport();
