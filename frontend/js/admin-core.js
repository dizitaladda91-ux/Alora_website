import BASE_URL from "./config.js";

const ORDER_STATUSES = ["paid", "processing", "packed", "shipped", "delivered", "cancelled"];
let adminOrders = [];

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

async function loadOrders() {
    const tableBody = document.getElementById("ordersTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">Loading orders...</td></tr>`;

    try {
        const response = await fetch(`${BASE_URL}/api/orders?limit=100`, { credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not load orders.");
        adminOrders = result.data || [];

        if (!adminOrders.length) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No saved orders yet.</td></tr>`;
            return;
        }

        tableBody.innerHTML = adminOrders.map((order) => `
            <tr class="hover:bg-gray-50 border-b">
                <td class="p-4 font-mono text-xs">${escapeHtml(order.razorpayOrderId)}</td>
                <td class="p-4"><div class="font-bold text-gray-800">${escapeHtml(order.customer?.name)}</div><div class="text-xs text-gray-500">${escapeHtml(order.customer?.phone)}</div></td>
                <td class="p-4 font-bold">${formatMoney(order.totalAmount)}</td>
                <td class="p-4"><span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold uppercase">${escapeHtml(order.paymentStatus)}</span></td>
                <td class="p-4">${order.orderStatus === "refunded" ? `<span class="text-xs font-semibold text-purple-700 uppercase">refunded</span>` : `<select class="border rounded-md text-xs p-1.5 bg-white" onchange="window.updateOrderStatus('${order._id}', this.value)">${ORDER_STATUSES.map((status) => `<option value="${status}" ${status === order.orderStatus ? "selected" : ""}>${status}</option>`).join("")}</select>`}</td>
                <td class="p-4"><input type="date" value="${order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().slice(0, 10) : ""}" class="border rounded-md text-xs p-1.5 bg-white" onchange="window.updateExpectedDelivery('${order._id}', this.value)"></td>
                <td class="p-4 flex gap-2"><button onclick="window.openInvoiceModal('${order._id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs"><i class="fa-solid fa-receipt"></i> Invoice</button>${order.paymentStatus === "paid" ? `<button onclick="window.refundOrder('${order._id}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs">Refund</button>` : ""}</td>
            </tr>`).join("");
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">${escapeHtml(error.message)}</td></tr>`;
    }
}

window.updateOrderStatus = async (orderId, orderStatus) => {
    try {
        const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderStatus })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Status update failed.");
        const index = adminOrders.findIndex((order) => order._id === orderId);
        if (index >= 0) adminOrders[index] = result.data;
    } catch (error) {
        alert(error.message);
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
        alert(error.message);
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
        alert("Refund successful. Stock has been restored.");
        loadOrders();
    } catch (error) {
        alert(error.message);
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
        alert(error.message);
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const logout = document.getElementById("adminLogoutBtn");
    logout?.addEventListener("click", async () => {
        await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        localStorage.removeItem("user");
        window.location.href = "./login.html";
    });

    document.getElementById("closeInvoiceBtn")?.addEventListener("click", () => document.getElementById("invoiceModal")?.classList.add("hidden"));
    document.getElementById("closeInvoiceBtn2")?.addEventListener("click", () => document.getElementById("invoiceModal")?.classList.add("hidden"));
    loadOrders();
});
