import BASE_URL from "./config.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const orderStatusInfo = (status) => {
  const states = {
    paid: ["Order booked", "Your payment is confirmed. We will start preparing your order shortly.", 0],
    processing: ["Processing", "Your order is being prepared.", 1],
    packed: ["Packed", "Your order has been packed and is ready to dispatch.", 2],
    shipped: ["Shipped", "Your order is on its way.", 3],
    delivered: ["Delivered", "Your order has been delivered.", 4],
    cancelled: ["Cancelled", "This order has been cancelled.", -1],
    refunded: ["Refunded", "Your payment has been refunded.", -1]
  };
  const [label, message, step] = states[String(status || "paid").toLowerCase()] || states.paid;
  return { label, message, step };
};

const orderProgress = (step) => {
  if (step < 0) return "";
  return `<div class="grid grid-cols-5 gap-1 mt-4">${["Booked", "Processing", "Packed", "Shipped", "Delivered"].map((stage, index) => `<div class="text-center"><div class="h-1.5 rounded-full ${index <= step ? "bg-[#A0522D]" : "bg-stone-200"}"></div><p class="mt-1.5 text-[10px] ${index <= step ? "text-[#A0522D] font-semibold" : "text-stone-400"}">${stage}</p></div>`).join("")}</div>`;
};
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

async function loadMyOrders() {
  const loader = document.getElementById("orders-loader");
  const list = document.getElementById("orders-list");
  try {
    const response = await fetch(`${BASE_URL}/api/orders/my`, { credentials: "include" });
    const result = await response.json();
    if (response.status === 401) {
      window.location.replace("./login.html");
      return;
    }
    if (!response.ok || !result.success) throw new Error(result.message || "Could not load your orders.");
    loader.remove();
    const orders = result.data || [];
    if (!orders.length) {
      list.innerHTML = `<div class="bg-white rounded-2xl border border-[#ECE4CE] p-10 text-center"><i class="fa-solid fa-bag-shopping text-3xl text-[#A0522D]"></i><h2 class="font-semibold text-lg mt-4">No orders yet</h2><a href="/products" class="inline-block mt-4 bg-[#A0522D] text-white px-5 py-2.5 rounded-lg text-sm">Shop Products</a></div>`;
      return;
    }
    list.innerHTML = orders.map((order) => {
      const status = orderStatusInfo(order.orderStatus);
      const activeOrder = !["cancelled", "refunded", "delivered"].includes(String(order.orderStatus || "").toLowerCase());
      const expectedDelivery = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "2–3 days";
      return `
      <article class="bg-white rounded-2xl border border-[#ECE4CE] p-5 sm:p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div><p class="text-xs text-stone-500">Order ID</p><p class="font-mono text-xs font-semibold break-all">${escapeHtml(order.razorpayOrderId)}</p></div>
          <div class="flex gap-2"><span class="px-3 py-1 rounded-full text-xs font-bold uppercase bg-stone-100 text-stone-700">${escapeHtml(order.paymentStatus)}</span><span class="px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#E8F3EC] text-[#1F7A55]">${escapeHtml(order.orderStatus)}</span></div>
        </div>
        <div class="mt-4 rounded-xl bg-[#FCF8EF] border border-[#ECE4CE] p-4"><div class="flex items-start gap-3"><i class="fa-solid fa-truck-fast text-[#A0522D] mt-0.5"></i><div><p class="text-sm font-semibold">${escapeHtml(status.label)}</p><p class="text-xs text-stone-600 mt-1">${escapeHtml(status.message)}</p>${activeOrder ? `<p class="text-xs font-semibold text-[#A0522D] mt-2">Expected delivery: ${escapeHtml(expectedDelivery)}</p>` : ""}</div></div>${orderProgress(status.step)}</div>
        <div class="py-4 space-y-2">${order.items.map((item) => `<div class="flex justify-between text-sm gap-4"><span>${escapeHtml(item.name)} <span class="text-stone-500">(${escapeHtml(item.variant)}) x ${item.quantity}</span></span><b>${money(item.lineTotal)}</b></div>`).join("")}</div>
        <div class="border-t border-stone-100 pt-4 flex justify-between items-center"><span class="text-xs text-stone-500">${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span><span class="font-bold">Total: ${money(order.totalAmount)}</span></div>
      </article>`;
    }).join("");
  } catch (error) {
    loader.innerHTML = `<p class="text-red-600">${escapeHtml(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadMyOrders);
