import BASE_URL from "./config.js";
import "./toast.js";
const ORDER_STATUSES = ["paid", "processing", "packed", "shipped", "delivered", "cancelled"];
let adminOrders = [];
let activeStatusFilter = "";
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
function renderOrderRow(order) {
    const itemsList = Array.isArray(order.items) && order.items.length > 0
        ? order.items.map((item) => `
            <div class="flex items-center gap-1.5 bg-amber-50/80 text-amber-950 text-[11px] px-2 py-1 rounded-lg border border-amber-200/80 font-medium">
                <i class="fa-solid fa-box text-[10px] text-amber-600 shrink-0"></i>
                <span class="font-bold truncate max-w-[150px]" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                ${item.variant ? `<span class="bg-white border border-amber-300 text-amber-800 px-1 py-0.2 rounded text-[9px] font-bold shrink-0">${escapeHtml(item.variant)}</span>` : ""}
                <span class="font-extrabold text-amber-900 ml-auto shrink-0">×${item.quantity}</span>
            </div>
          `).join("")
        : `<span class="text-xs text-gray-400 italic">No products listed</span>`;

    return `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-4 font-mono text-xs font-bold text-gray-700">${escapeHtml(order.razorpayOrderId)}</td>
            <td class="p-4">
                <div class="font-bold text-gray-800">${escapeHtml(order.customer?.name)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(order.customer?.phone)}</div>
                <div class="text-[11px] text-gray-400 max-w-[180px] truncate" title="${escapeHtml(order.customer?.address)}">${escapeHtml(order.customer?.address)}</div>
            </td>
            <td class="p-4 min-w-[210px] max-w-[260px]">
                <div class="space-y-1">
                    ${itemsList}
                </div>
            </td>
            <td class="p-4 font-bold text-gray-900">${formatMoney(order.totalAmount)}</td>
            <td class="p-4"><span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold uppercase">${escapeHtml(order.paymentStatus)}</span></td>
            <td class="p-4">${order.orderStatus === "refunded" ? `<span class="text-xs font-semibold text-purple-700 uppercase">refunded</span>` : `<select class="border border-gray-300 rounded-md text-xs p-1.5 bg-white font-medium shadow-sm outline-none focus:ring-2 focus:ring-amber-500" onchange="window.updateOrderStatus('${order._id}', this.value)">${ORDER_STATUSES.map((status) => `<option value="${status}" ${status === order.orderStatus ? "selected" : ""}>${status.toUpperCase()}</option>`).join("")}</select>`}</td>
            <td class="p-4"><input type="date" value="${order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().slice(0, 10) : ""}" class="border border-gray-300 rounded-md text-xs p-1.5 bg-white font-medium" onchange="window.updateExpectedDelivery('${order._id}', this.value)"></td>
            <td class="p-4">
                <div class="flex flex-col gap-1 w-44">
                    <input id="track-num-${order._id}" type="text" placeholder="Tracking No." value="${escapeHtml(order.trackingNumber || "")}" class="border border-gray-300 rounded-md text-xs p-1.5 bg-white">
                    <input id="track-link-${order._id}" type="text" placeholder="Courier link (https://...)" value="${escapeHtml(order.courierLink || "")}" class="border border-gray-300 rounded-md text-xs p-1.5 bg-white">
                    <button onclick="window.saveTracking('${order._id}')" class="bg-gray-700 hover:bg-gray-800 text-white text-xs py-1 rounded-md transition font-medium">Save Details</button>
                </div>
            </td>
            <td class="p-4 flex flex-col gap-1.5 justify-center">
                <button onclick="window.openInvoiceModal('${order._id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition inline-flex items-center justify-center gap-1"><i class="fa-solid fa-receipt"></i> Invoice</button>
                ${order.paymentStatus === "paid" && order.orderStatus !== "refunded" ? `<button onclick="window.refundOrder('${order._id}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition">Refund</button>` : ""}
            </td>
        </tr>`;
}
async function loadOrders() {
    const activeTableBody = document.getElementById("activeOrdersTableBody") || document.getElementById("ordersTableBody");
    const deliveredTableBody = document.getElementById("deliveredOrdersTableBody");
    const activeCountEl = document.getElementById("activeOrderCount");
    const deliveredCountEl = document.getElementById("deliveredOrderCount");
    if (!activeTableBody) return;
    activeTableBody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading orders...</td></tr>`;
    if (deliveredTableBody) {
        deliveredTableBody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading delivered orders...</td></tr>`;
    }
    try {
        const statusQuery = activeStatusFilter ? `&status=${encodeURIComponent(activeStatusFilter)}` : "";
        const response = await fetch(`${BASE_URL}/api/orders?limit=200${statusQuery}`, { credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not load orders.");
        adminOrders = result.data || [];
        const activeOrders = adminOrders.filter((o) => o.orderStatus !== "delivered");
        const deliveredOrders = adminOrders.filter((o) => o.orderStatus === "delivered");
        if (activeCountEl) activeCountEl.innerText = activeOrders.length;
        if (deliveredCountEl) deliveredCountEl.innerText = deliveredOrders.length;
        if (!activeOrders.length) {
            activeTableBody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-boxes-packing text-2xl mb-2 block"></i> No new or active orders currently.</td></tr>`;
        } else {
            activeTableBody.innerHTML = activeOrders.map(renderOrderRow).join("");
        }
        if (deliveredTableBody) {
            if (!deliveredOrders.length) {
                deliveredTableBody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-400 font-medium"><i class="fa-solid fa-circle-check text-2xl mb-2 block"></i> No delivered orders yet.</td></tr>`;
            } else {
                deliveredTableBody.innerHTML = deliveredOrders.map(renderOrderRow).join("");
            }
        }
    } catch (error) {
        activeTableBody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-red-500">${escapeHtml(error.message)}</td></tr>`;
    }
}
async function patchOrder(orderId, body) {
    const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Update failed.");
    const index = adminOrders.findIndex((order) => order._id === orderId);
    if (index >= 0) adminOrders[index] = result.data;
    return result.data;
}
window.updateOrderStatus = async (orderId, orderStatus) => {
    try {
        const body = { orderStatus };
        if (orderStatus === "shipped") {
            const trackingInput = document.getElementById(`track-num-${orderId}`);
            let trackingNumber = trackingInput?.value.trim() || "";
            if (!trackingNumber) {
                trackingNumber = window.prompt("Enter the tracking number for this shipment:", "")?.trim() || "";
                if (!trackingNumber) throw new Error("A tracking number is required to mark an order as shipped.");
            }
            const courierLink = document.getElementById(`track-link-${orderId}`)?.value.trim() || "";
            body.trackingNumber = trackingNumber;
            if (courierLink) body.courierLink = courierLink;
        }
        await patchOrder(orderId, body);
        window.showToast(`Order status updated to '${orderStatus}'.`, "success");
        loadOrders();
    } catch (error) {
        window.showToast(error.message, "error");
        loadOrders();
    }
};
window.saveTracking = async (orderId) => {
    try {
        const trackingNumber = document.getElementById(`track-num-${orderId}`)?.value.trim() || "";
        const courierLink = document.getElementById(`track-link-${orderId}`)?.value.trim() || "";
        const order = adminOrders.find((entry) => entry._id === orderId);
        await patchOrder(orderId, { orderStatus: order?.orderStatus, trackingNumber, courierLink });
        window.showToast("Tracking details saved.", "success");
    } catch (error) {
        window.showToast(error.message, "error");
        loadOrders();
    }
};
window.updateExpectedDelivery = async (orderId, expectedDeliveryDate) => {
    if (!expectedDeliveryDate) return;
    try {
        const response = await fetch(`${BASE_URL}/api/orders/${orderId}/expected-delivery`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedDeliveryDate })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Delivery date update failed.");
        const index = adminOrders.findIndex((order) => order._id === orderId);
        if (index >= 0) adminOrders[index] = result.data;
    } catch (error) {
        window.showToast(error.message, "error");
        loadOrders();
    }
};
window.refundOrder = async (orderId) => {
    const reason = window.prompt("Refund reason (optional):", "Requested by admin");
    if (reason === null) return;
    if (!window.confirm("This will issue a real full refund through Razorpay and restore inventory. Continue?")) return;
    try {
        const response = await fetch(`${BASE_URL}/api/orders/${orderId}/refund`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Refund failed.");
        window.showToast("Refund successful. Stock has been restored.", "success");
        loadOrders();
    } catch (error) {
        window.showToast(error.message, "error");
    }
};
window.openInvoiceModal = async (orderId) => {
    try {
        const response = await fetch(`${BASE_URL}/api/orders/${orderId}`, { credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not load order.");
        const order = result.data;
        document.getElementById("invOrderId").innerText = `#${order.razorpayOrderId}`;
        document.getElementById("invCustomer").innerText = order.customer.name;
        document.getElementById("invEmail").innerText = `Phone: ${order.customer.phone} | Address: ${order.customer.address}`;
        document.getElementById("invDate").innerText = `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`;
        document.getElementById("invStatus").innerText = `${order.paymentStatus.toUpperCase()} / ${order.orderStatus.toUpperCase()}`;
        document.getElementById("invTotalAmount").innerText = formatMoney(order.totalAmount);
        document.getElementById("invItemsTable").innerHTML = order.items.map((item) => `<tr class="border-b"><td class="p-2">${escapeHtml(item.name)} (${escapeHtml(item.variant)})</td><td class="p-2 text-center">${item.quantity}</td><td class="p-2 text-right">${formatMoney(item.lineTotal)}</td></tr>`).join("");
        document.getElementById("invoiceModal")?.classList.remove("hidden");
    } catch (error) {
        window.showToast(error.message, "error");
    }
};
document.addEventListener("DOMContentLoaded", async () => {
    const logout = document.getElementById("adminLogoutBtn");
    logout?.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
            await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        } catch (err) {
            console.warn("Logout error:", err);
        } finally {
            sessionStorage.clear();
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            localStorage.removeItem("userToken");
            localStorage.removeItem("userRole");
            localStorage.removeItem("tabAuthActive");
            window.location.replace("./login.html");
        }
    });
    document.getElementById("closeInvoiceBtn")?.addEventListener("click", () => document.getElementById("invoiceModal")?.classList.add("hidden"));
    document.getElementById("closeInvoiceBtn2")?.addEventListener("click", () => document.getElementById("invoiceModal")?.classList.add("hidden"));
    document.getElementById("statusFilter")?.addEventListener("change", (event) => {
        activeStatusFilter = event.target.value;
        loadOrders();
    });
    loadOrders();
});