import BASE_URL, { getAuthHeaders, getImageUrl } from './config.js';
document.addEventListener('DOMContentLoaded', () => {
    initAccountPage();
});
async function initAccountPage() {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (!userStr && !token) {
        window.location.href = './login.html';
        return;
    }
    let user = null;
    try {
        if (userStr) user = JSON.parse(userStr);
    } catch (e) {
        console.warn('User parse error:', e);
    }
    const greetingEl = document.getElementById('user-greeting');
    const emailEl = document.getElementById('user-email');
if (user) {
    if (greetingEl) greetingEl.textContent = `Hello, ${user.name || user.username || 'Valued Customer'}`;
    if (emailEl) emailEl.textContent = user.phone
        ? `${user.email || ''} • ${user.phone}`
        : (user.email || 'Alora Radiance Customer');
}
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            localStorage.removeItem('userToken');
            localStorage.removeItem('token');
            window.location.href = './login.html';
        });
    }
    await loadMyOrders();
}
async function loadMyOrders() {
    const container = document.getElementById('orders-container');
    const countBadge = document.getElementById('order-count-badge');
    if (!container) return;
    try {
        const response = await fetch(`${BASE_URL}/api/orders/my`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                container.innerHTML = `
                    <div class="bg-amber-50 text-amber-900 p-8 rounded-3xl border border-amber-200 text-center space-y-3">
                        <i class="fa-solid fa-user-lock text-clay text-3xl mb-1"></i>
                        <h3 class="font-serif font-bold text-lg">Session Expired or Login Required</h3>
                        <p class="text-xs text-ash">Please log in again to view your order history and tracking status.</p>
                        <a href="./login.html" class="inline-block bg-clay hover:bg-clay-dark text-white font-bold text-xs px-6 py-2.5 rounded-xl transition">Log In Now</a>
                    </div>
                `;
                return;
            }
            throw new Error(result.message || 'Could not load order history.');
        }
        const orders = result.data || [];
        if (countBadge) countBadge.textContent = `${orders.length} Order${orders.length === 1 ? '' : 's'}`;
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-3xl p-10 border border-[#ECE4CE] text-center space-y-4 shadow-sm">
                    <i class="fa-solid fa-bag-shopping text-clay text-4xl mb-2"></i>
                    <h3 class="font-serif font-bold text-ink text-xl">No Orders Placed Yet</h3>
                    <p class="text-sm text-ash max-w-md mx-auto">Explore our range of premium skincare products and place your first order today!</p>
                    <a href="/products" class="inline-block bg-clay hover:bg-clay-dark text-white font-semibold text-xs px-6 py-3 rounded-xl transition uppercase tracking-wider shadow">
                        Shop Now &rarr;
                    </a>
                </div>
            `;
            return;
        }
        container.innerHTML = orders.map(order => renderOrderCard(order)).join('');
    } catch (error) {
        console.error('Failed to load orders:', error);
        container.innerHTML = `
            <div class="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 text-center text-sm font-semibold">
                ${error.message || 'Error loading your orders.'}
            </div>
        `;
    }
}
function renderOrderCard(order) {
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const status = (order.orderStatus || order.status || 'Processing').toLowerCase();
    let statusBadgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
    let statusText = 'Processing';
    if (status === 'shipped' || status === 'out_for_delivery') {
        statusBadgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
        statusText = 'Shipped / Out for Delivery';
    } else if (status === 'delivered') {
        statusBadgeClass = 'bg-green-100 text-green-800 border-green-300';
        statusText = 'Delivered';
    } else if (status === 'cancelled') {
        statusBadgeClass = 'bg-red-100 text-red-800 border-red-300';
        statusText = 'Cancelled';
    }
    const items = order.items || order.orderItems || [];
    const trackingQuery = order.razorpayOrderId || order.razorpayPaymentId || order._id;
    const itemsHTML = items.map(item => {
        const itemImg = item.image || item.imagepath || item.baseImg || '';
        const itemPrice = item.unitPrice || item.price || 0;
        const itemQty = item.quantity || item.qty || 1;
        const itemVariant = item.variant || item.size || item.activeSelectedSizeConfig || 'Standard';
        return `
            <div class="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-3">
<img src="${getImageUrl(itemImg, '/static/placeholder.png')}" alt="${item.name}" loading="lazy" class="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-parchment/50 p-1">
                    <div>
                        <h4 class="font-semibold text-ink text-sm leading-snug">${item.name}</h4>
                        <p class="text-xs text-ash">Size: ${itemVariant} &bull; Qty: ${itemQty}</p>
                    </div>
                </div>
                <span class="font-semibold text-ink text-sm">₹${itemPrice * itemQty}</span>
            </div>
        `;
    }).join('');
    return `
        <div class="bg-white rounded-3xl border border-[#ECE4CE] shadow-sm p-6 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#ECE4CE] pb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-serif font-bold text-ink text-lg">Order #${String(order.razorpayOrderId || order._id).slice(-8)}</span>
                        <span class="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusBadgeClass}">${statusText}</span>
                    </div>
                    <p class="text-xs text-ash mt-1"><i class="fa-regular fa-calendar mr-1"></i> Placed on ${orderDate}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-serif font-bold text-ink text-xl">₹${order.totalAmount || order.totalPrice || 0}</span>
                    <a href="/track-order?id=${encodeURIComponent(trackingQuery)}" class="bg-ink hover:bg-ink-light text-white text-xs font-semibold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-location-dot text-gold text-xs"></i> Track
                    </a>
                </div>
            </div>
            <div class="space-y-1">
                ${itemsHTML}
            </div>
            <div class="bg-parchment/60 p-4 rounded-2xl border border-[#E7DFC7] flex flex-col sm:flex-row justify-between gap-3 text-xs text-ash">
                <div>
                    <strong class="text-ink block mb-0.5">Shipping Address:</strong>
                    ${order.customer?.address || order.shippingAddress?.address || 'Address registered on file'}
                </div>
                <div class="sm:text-right">
                    <strong class="text-ink block mb-0.5">Payment ID:</strong>
                    <span class="font-mono text-ink">${order.razorpayPaymentId || 'Paid online'}</span>
                </div>
            </div>
        </div>
    `;
}