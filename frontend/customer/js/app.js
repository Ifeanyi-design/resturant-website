// ============================================================================
//  Customer storefront
// ============================================================================
//  Menu browsing, category filtering and the cart. The cart itself lives in
//  localStorage under "cart" as [{ item_id, quantity }] - the checkout page
//  reads the same key, so the two stay in step.
//
//  Data comes through window.api (from ../js/api.js), which attaches the JWT
//  and centralises error handling.
// ============================================================================

const menuContainer = document.getElementById('menu-container');
const cartContainer = document.getElementById('cart-container');
const categoryChips = document.getElementById('category-chips');
const cartCount = document.getElementById('cart-count');

let menuItems = [];
let categories = [];
let activeCategory = 'all';

let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Temporary "just added" state per item id.
let addedMessage = {};


// ============================================================================
//  DISH PHOTOGRAPHY
// ============================================================================
//  Photos live in ../assets/menu/. They are matched by dish NAME rather than
//  by item_id, because ids shift if the database is re-seeded but the dish
//  names do not. Anything unmatched falls back to its category photo, then to
//  the hero shot, so a newly added dish never renders a broken image.
// ============================================================================

const PHOTO_BY_NAME = {
    'jollof rice with chicken': 'jollof-rice',
    'fried rice with beef': 'fried-rice',
    'spaghetti bolognese': 'spaghetti',
    'peppered chicken': 'peppered-chicken',
    'grilled beef suya': 'suya',
    'moi moi': 'moi-moi',
    'coleslaw': 'coleslaw',
    'bottled water': 'water',
    'soft drink': 'soft-drink',
    'fruit juice': 'juice'
};

const PHOTO_BY_CATEGORY = {
    'rice dishes': 'cat-rice',
    'noodles & pasta': 'cat-pasta',
    'grills & proteins': 'cat-grill',
    'sides': 'cat-sides',
    'drinks': 'cat-drinks'
};

function photoFor(item) {
    const byName = PHOTO_BY_NAME[String(item.item_name).toLowerCase().trim()];
    if (byName) {
        return `../assets/menu/${byName}.jpg`;
    }

    const byCategory =
        PHOTO_BY_CATEGORY[String(item.category_name || '').toLowerCase().trim()];

    if (byCategory) {
        return `../assets/menu/${byCategory}.jpg`;
    }

    return '../assets/menu/hero.jpg';
}


// ============================================================================
//  LOAD
// ============================================================================

async function loadMenu() {
    try {
        const [menu, cats] = await Promise.all([
            window.api.get('/api/menu'),
            window.api.get('/api/categories').catch(() => [])
        ]);

        menuItems = menu;
        categories = cats;

        renderCategories();
        renderMenu();
        renderCart();

    } catch (error) {
        console.error(error);
        menuContainer.innerHTML = `
            <p class="muted">Failed to load the menu. Is the backend running?</p>
        `;
    }
}


// ============================================================================
//  CATEGORY CHIPS
// ============================================================================

function renderCategories() {
    if (!categoryChips) {
        return;
    }

    const used = new Set(
        menuItems
            .map(item => item.category_name)
            .filter(Boolean)
    );

    const chips = [
        `<button type="button" class="chip${activeCategory === 'all' ? ' active' : ''}" data-category="all">All dishes</button>`
    ];

    categories
        .filter(category => used.has(category.category_name))
        .forEach(category => {
            const active = activeCategory === category.category_name ? ' active' : '';
            chips.push(
                `<button type="button" class="chip${active}" data-category="${category.category_name}">${category.category_name}</button>`
            );
        });

    categoryChips.innerHTML = chips.join('');

    categoryChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            activeCategory = chip.dataset.category;
            renderCategories();
            renderMenu();
        });
    });
}


// ============================================================================
//  MENU GRID
// ============================================================================

function renderMenu() {
    const visible = activeCategory === 'all'
        ? menuItems
        : menuItems.filter(item => item.category_name === activeCategory);

    if (visible.length === 0) {
        menuContainer.innerHTML = `<p class="muted">No dishes in this category.</p>`;
        return;
    }

    menuContainer.innerHTML = visible.map(item => {
        const available = Number(item.availability) === 1;
        const justAdded = Boolean(addedMessage[item.item_id]);

        let action;

        if (!available) {
            action = `<button class="dish-add" disabled aria-label="Unavailable">&mdash;</button>`;
        } else if (justAdded) {
            action = `
                <button class="dish-add dish-added" disabled aria-label="Added to cart">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                </button>`;
        } else {
            action = `
                <button class="dish-add" onclick="addToCart(${item.item_id})"
                        aria-label="Add ${item.item_name} to cart">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 5v14"/>
                        <path d="M5 12h14"/>
                    </svg>
                </button>`;
        }

        const tag = item.category_name
            ? `<span class="dish-tag">${item.category_name}</span>`
            : '';

        const soldOut = available
            ? ''
            : `<span class="dish-sold-out">Sold out</span>`;

        return `
            <article class="dish-card">
                <div class="dish-media">
                    <img src="${photoFor(item)}"
                         alt="${item.item_name}"
                         loading="lazy"
                         width="900" height="675">
                    ${tag}
                    ${soldOut}
                </div>

                <div class="dish-body">
                    <h3>${item.item_name}</h3>
                    <p class="dish-desc">${item.description || 'Freshly prepared in our kitchen.'}</p>

                    <div class="dish-foot">
                        <span class="dish-price">&#8358;${Number(item.price).toLocaleString()}</span>
                        ${action}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}


// ============================================================================
//  CART
// ============================================================================

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(itemId) {
    const existing = cart.find(line => line.item_id === itemId);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ item_id: itemId, quantity: 1 });
    }

    saveCart();

    addedMessage[itemId] = true;

    renderMenu();
    renderCart();

    setTimeout(() => {
        addedMessage[itemId] = false;
        renderMenu();
    }, 1400);
}

function removeFromCart(itemId) {
    cart = cart.filter(line => line.item_id !== itemId);
    saveCart();
    renderMenu();
    renderCart();
}

function cartLines() {
    return cart
        .map(line => {
            const item = menuItems.find(menuItem => menuItem.item_id === line.item_id);
            if (!item) {
                return null;
            }
            const unitPrice = Number(item.price);
            return {
                item,
                quantity: line.quantity,
                unitPrice,
                subtotal: unitPrice * line.quantity
            };
        })
        .filter(Boolean);
}

function renderCart() {
    const lines = cartLines();

    // Header badge counts total items, not distinct lines.
    if (cartCount) {
        const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
        cartCount.textContent = totalItems;
    }

    if (lines.length === 0) {
        cartContainer.innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="20" r="1.4"/>
                    <circle cx="18" cy="20" r="1.4"/>
                    <path d="M2 3h3l2.4 11.2a1.8 1.8 0 0 0 1.8 1.4h8.4a1.8 1.8 0 0 0 1.8-1.4L21 7H6"/>
                </svg>
                <p>Your cart is empty.</p>
                <p class="muted">Add a dish to get started.</p>
            </div>
        `;
        return;
    }

    const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

    const rows = lines.map(line => `
        <div class="cart-line">
            <div>
                <span class="cart-line-name">${line.item.item_name}</span>
                <span class="cart-line-meta">
                    ${line.quantity} &#215; &#8358;${line.unitPrice.toLocaleString()}
                </span>
                <br>
                <button class="cart-remove" onclick="removeFromCart(${line.item.item_id})">
                    Remove
                </button>
            </div>
            <span class="cart-line-price">&#8358;${line.subtotal.toLocaleString()}</span>
        </div>
    `).join('');

    cartContainer.innerHTML = `
        ${rows}

        <div class="cart-summary">
            <div class="cart-row">
                <span>Items</span>
                <span>${lines.reduce((sum, line) => sum + line.quantity, 0)}</span>
            </div>
            <div class="cart-row cart-row-total">
                <span>Total</span>
                <span>&#8358;${total.toLocaleString()}</span>
            </div>
        </div>

        <button class="cart-checkout" onclick="checkout()">
            Proceed to checkout
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 style="width:17px;height:17px">
                <path d="M5 12h14"/>
                <path d="M13 6l6 6-6 6"/>
            </svg>
        </button>
    `;
}


// ============================================================================
//  NAVIGATION
// ============================================================================

function checkout() {
    if (cart.length === 0) {
        alert('Your cart is empty.');
        return;
    }

    window.location.href = 'checkout/index.html';
}

function scrollToMenu() {
    document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('customer');
    localStorage.removeItem('customer_id');
    localStorage.removeItem('cart');

    window.location.href = '../index.html';
});


// ============================================================================
//  START
// ============================================================================

loadMenu();
