// ============================================================================
//  Public order tracking
// ============================================================================
//  No login required. The customer enters an order number plus the phone or
//  email on the order; the API checks the pair matches before returning
//  anything, so order numbers cannot be enumerated.
//
//  The page is deliberately read-only: it shows status and items, and never
//  lets the visitor change anything.
// ============================================================================

const form = document.getElementById('track-form');
const orderIdInput = document.getElementById('order-id');
const contactInput = document.getElementById('contact');
const trackBtn = document.getElementById('track-btn');

const messageBox = document.getElementById('message');
const result = document.getElementById('result');


// The happy path, in order. "Cancelled" is handled separately because it is an
// exit, not a step along the way.
const STAGES = [
    { key: 'Pending',   label: 'Order received', note: 'We have your order' },
    { key: 'Preparing', label: 'In the kitchen', note: 'Being cooked now' },
    { key: 'Ready',     label: 'Ready',          note: 'Ready to collect' },
    { key: 'Completed', label: 'Completed',      note: 'Enjoy your meal' }
];

const TICK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const CROSS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';


function showError(text) {
    messageBox.className = 'error';
    messageBox.textContent = text;
}

function clearMessage() {
    messageBox.className = '';
    messageBox.textContent = '';
}

function money(value) {
    return '\u20A6' + Number(value || 0).toLocaleString();
}


// ============================================================================
//  TIMELINE
// ============================================================================

function renderTimeline(status) {
    const timeline = document.getElementById('timeline');

    if (status === 'Cancelled') {
        timeline.innerHTML = `
            <li class="track-step cancelled">
                <span class="track-dot">${CROSS}</span>
                <span class="track-text">
                    <strong>Order cancelled</strong>
                    <small>This order was cancelled and will not be prepared.</small>
                </span>
            </li>
        `;
        return;
    }

    const currentIndex = STAGES.findIndex(stage => stage.key === status);

    timeline.innerHTML = STAGES.map((stage, index) => {
        let state = 'todo';

        if (currentIndex > -1) {
            if (index < currentIndex) {
                state = 'done';
            } else if (index === currentIndex) {
                state = 'current';
            }
        }

        const dot = state === 'done'
            ? TICK
            : String(index + 1);

        return `
            <li class="track-step ${state}">
                <span class="track-dot">${dot}</span>
                <span class="track-text">
                    <strong>${stage.label}</strong>
                    <small>${stage.note}</small>
                </span>
            </li>
        `;
    }).join('');
}


// ============================================================================
//  RESULT
// ============================================================================

function renderResult(data) {
    const order = data.order;

    document.getElementById('result-order').textContent = '#' + order.order_id;

    document.getElementById('result-placed').textContent =
        'Placed ' + new Date(order.order_date).toLocaleString();

    document.getElementById('result-status').textContent = order.status;
    document.getElementById('result-total').textContent = money(order.total_amount);

    const paymentEl = document.getElementById('result-payment');
    const paymentClass = String(order.payment_status).toLowerCase();
    paymentEl.className = 'status ' + (paymentClass === 'paid' ? 'paid' : 'pending');
    paymentEl.textContent = order.payment_status;

    document.getElementById('result-count').textContent =
        data.items.length + (data.items.length === 1 ? ' item' : ' items');

    document.getElementById('result-items').innerHTML = data.items.map(item => `
        <div class="order-item">
            <div>
                <strong>${item.item_name}</strong>
                <p class="muted">${item.quantity} &#215; ${money(item.unit_price)}</p>
            </div>
            <strong>${money(item.subtotal)}</strong>
        </div>
    `).join('');

    renderTimeline(order.status);

    result.hidden = false;
}


// ============================================================================
//  SUBMIT
// ============================================================================

form.addEventListener('submit', async function (event) {
    event.preventDefault();

    clearMessage();
    result.hidden = true;

    trackBtn.disabled = true;
    trackBtn.textContent = 'Looking it up...';

    try {
        const data = await window.api.post('/api/orders/track', {
            order_id: Number(orderIdInput.value),
            contact: contactInput.value.trim()
        });

        renderResult(data);

        // Keep the order number in the URL so the page can be bookmarked or
        // shared, and so a refresh re-runs the same lookup.
        const url = new URL(window.location.href);
        url.searchParams.set('order', String(data.order.order_id));
        window.history.replaceState({}, '', url);

    } catch (error) {
        console.error(error);
        showError(error.message || 'Could not find that order.');

    } finally {
        trackBtn.disabled = false;
        trackBtn.innerHTML =
            '<span class="icon icon-sm" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></span> Track order';
    }
});


// ============================================================================
//  START
// ============================================================================

// Pre-fill the order number if it was passed in the URL (?order=12).
const preset = new URLSearchParams(window.location.search).get('order');

if (preset) {
    orderIdInput.value = preset;
    contactInput.focus();
}
