// ============================================================================
//  Order lifecycle — the single source of truth (PRD FR5)
// ============================================================================
//
//      Pending ──► Preparing ──► Ready ──► Completed
//         │            │           │
//         └────────────┴───────────┴──────► Cancelled
//
//  Completed and Cancelled are terminal.
//
//  Both routes/orders.js (which enforces the rules) and routes/reports.js
//  (which reports counts per status) import from here, so the set of valid
//  statuses cannot drift between them.
// ============================================================================

const ORDER_STATUSES = [
    'Pending',
    'Preparing',
    'Ready',
    'Completed',
    'Cancelled'
];

const ALLOWED_TRANSITIONS = {
    Pending:   ['Preparing', 'Cancelled'],
    Preparing: ['Ready', 'Cancelled'],
    Ready:     ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: []
};

// A cancelled order never happened, so it is excluded from sales and
// popularity reporting.
const REPORTABLE_STATUSES = ORDER_STATUSES.filter(
    (status) => status !== 'Cancelled'
);

module.exports = {
    ORDER_STATUSES,
    ALLOWED_TRANSITIONS,
    REPORTABLE_STATUSES
};
