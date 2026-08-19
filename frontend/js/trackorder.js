import BASE_URL, { getImageUrl } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    initTrackingPage();
});

function initTrackingPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromURL = urlParams.get('id') || urlParams.get('orderId');

    const input = document.getElementById('track-input');
    const form = document.getElementById('track-form');

    if (idFromURL && input) {
        input.value = idFromURL;
        performTrackingLookup(idFromURL);
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (query) performTrackingLookup(query);
        });
    }
}

async function performTrackingLookup(query) {
    const container = document.getElementById('tracking-result-container');
    const button = document.getElementById('track-btn');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="bg-white rounded-3xl p-8 border border-[#ECE4CE] shadow-sm text-center space-y-4 animate-pulse">
            <i class="fa-solid fa-spinner fa-spin text-clay text-3xl"></i>
            <p class="text-sm font-semibold text-ink">Searching shipment details...</p>
        </div>
    `;

    if (button) {
        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Searching...`;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/orders/track/${encodeURIComponent(query)}`);
        const result = await response.json();

        if (!response.ok || !result.data) {
            throw new Error(result.message || 'No active order matching your query was found.');
        }

        renderTrackingDetails(result.data);

    } catch (error) {
        console.error('Tracking Error:', error);
        container.innerHTML = `
            <div class="bg-white rounded-3xl p-8 border border-red-200 shadow-sm text-center space-y-3">
                <i class="fa-solid fa-triangle-exclamation text-red-500 text-3xl"></i>
                <h3 class="font-serif font-bold text-ink text-xl">Order Not Found</h3>
                <p class="text-xs text-ash max-w-md mx-auto">${error.message}</p>
                <p class="text-xs text-ash">Double check your Order ID, Payment ID, or registered Phone number and try again.</p>
            </div>
        `;
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="fa-solid fa-location-arrow"></i> Track Status`;
        }
    }
}

function renderTrackingDetails(order) {
    const container = document.getElementById('tracking-result-container');
    if (!container) return;

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const status = String(order.orderStatus || order.status || 'processing').toLowerCase();

    // Timeline Steps Logic
    const step1 = true; // Order Placed
    const step2 = status === 'processing' || status === 'packed' || status === 'shipped' || status === 'out_for_delivery' || status === 'delivered';
    const step3 = status === 'shipped' || status === 'out_for_delivery' || status === 'delivered';
    const step4 = status === 'delivered';

    const items = order.items || order.orderItems || [];

    const itemsHTML = items.map(item => {
        const itemImg = item.image || item.imagepath || item.baseImg || '';
        const itemPrice = item.unitPrice || item.price || 0;
        const itemQty = item.quantity || item.qty || 1;
        const itemVariant = item.variant || item.size || item.activeSelectedSizeConfig || 'Standard';

        return `
            <div class="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-3">
                    <img src="${getImageUrl(itemImg, './static/placeholder.png')}" alt="${item.name}" class="w-12 h-12 object-contain rounded-lg border border-gray-200 bg-parchment/50 p-1">
                    <div>
                        <h4 class="font-semibold text-ink text-sm leading-snug">${item.name}</h4>
                        <p class="text-xs text-ash">Qty: ${itemQty} &bull; Size: ${itemVariant}</p>
                    </div>
                </div>
                <span class="font-semibold text-ink text-sm">₹${itemPrice * itemQty}</span>
            </div>
        `;
    }).join('');

    const courierCode = order.courierTrackingNumber || order.trackingNumber || '';

    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-[#ECE4CE] shadow-sm p-6 sm:p-8 space-y-8">
            
            <!-- Top Header Info -->
            <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#ECE4CE] pb-6">
                <div>
                    <div class="flex items-center gap-3">
                        <h2 class="text-2xl font-serif font-bold text-ink">Order #${String(order.razorpayOrderId || order._id).slice(-8)}</h2>
                        <span class="bg-sage/15 text-sage border border-sage/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            ${status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <p class="text-xs text-ash mt-1">Placed on ${orderDate} &bull; Payment Verified</p>
                </div>
                <div class="text-left sm:text-right">
                    <span class="text-xs text-ash block">Total Amount Paid</span>
                    <span class="text-2xl font-serif font-bold text-ink">₹${order.totalAmount || order.totalPrice || 0}</span>
                </div>
            </div>

            <!-- Stepper Timeline Progress Bar -->
            <div class="py-4">
                <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-ash mb-6">Shipment Timeline</h3>
                
                <div class="relative flex items-center justify-between max-w-2xl mx-auto px-4">
                    <!-- Line Track -->
                    <div class="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-gray-200 -z-0"></div>
                    <div class="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-sage transition-all duration-500 -z-0" style="width: ${step4 ? '100%' : step3 ? '66%' : step2 ? '33%' : '0%'}"></div>

                    <!-- Step 1: Placed -->
                    <div class="flex flex-col items-center gap-2 relative z-10">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow ${step1 ? 'bg-sage text-white' : 'bg-gray-200 text-gray-500'}">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <span class="text-[11px] font-semibold ${step1 ? 'text-ink' : 'text-ash'}">Order Placed</span>
                    </div>

                    <!-- Step 2: Processing -->
                    <div class="flex flex-col items-center gap-2 relative z-10">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow ${step2 ? 'bg-sage text-white' : 'bg-gray-200 text-gray-500'}">
                            <i class="fa-solid fa-box"></i>
                        </div>
                        <span class="text-[11px] font-semibold ${step2 ? 'text-ink' : 'text-ash'}">Packed &amp; Verified</span>
                    </div>

                    <!-- Step 3: Shipped -->
                    <div class="flex flex-col items-center gap-2 relative z-10">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow ${step3 ? 'bg-sage text-white' : 'bg-gray-200 text-gray-500'}">
                            <i class="fa-solid fa-truck-fast"></i>
                        </div>
                        <span class="text-[11px] font-semibold ${step3 ? 'text-ink' : 'text-ash'}">Out for Delivery</span>
                    </div>

                    <!-- Step 4: Delivered -->
                    <div class="flex flex-col items-center gap-2 relative z-10">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow ${step4 ? 'bg-sage text-white' : 'bg-gray-200 text-gray-500'}">
                            <i class="fa-solid fa-house-chimney-check"></i>
                        </div>
                        <span class="text-[11px] font-semibold ${step4 ? 'text-ink' : 'text-ash'}">Delivered</span>
                    </div>
                </div>
            </div>

            <!-- Items Purchased -->
            <div class="border-t border-[#ECE4CE] pt-6 space-y-4">
                <h3 class="text-xs font-bold uppercase tracking-[0.2em] text-ash">Items in Order</h3>
                <div class="space-y-1">
                    ${itemsHTML}
                </div>
            </div>

            <!-- Delivery Details Box -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-parchment/60 p-5 rounded-2xl border border-[#E7DFC7] text-xs">
                <div>
                    <strong class="text-ink text-sm block mb-1">Delivery Recipient:</strong>
                    <p class="font-semibold text-ink">${order.customer?.name || 'Customer'}</p>
                    <p class="text-ash mt-0.5">${order.customer?.address || 'Address on file'}</p>
                    <p class="text-ash mt-0.5">Phone: ${order.customer?.phone || 'N/A'}</p>
                </div>
                <div>
                    <strong class="text-ink text-sm block mb-1">Tracking Info:</strong>
                    <p class="text-ash font-mono">Payment Ref: ${order.razorpayPaymentId || 'Verified'}</p>
                    ${courierCode ? `<p class="mt-1 font-bold text-clay"><i class="fa-solid fa-barcode mr-1"></i> Courier AW: ${courierCode}</p>` : `<p class="mt-1 text-ash italic">Courier tracking link will update once dispatched.</p>`}
                    ${order.courierLink ? `<p class="mt-1"><a href="${order.courierLink}" target="_blank" class="text-clay underline font-semibold">Track on Courier Website &rarr;</a></p>` : ''}
                </div>
            </div>

        </div>
    `;
}
