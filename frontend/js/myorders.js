import BASE_URL from "./config.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
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
      list.innerHTML = `<div class="bg-white rounded-2xl border border-[#ECE4CE] p-10 text-center"><i class="fa-solid fa-bag-shopping text-3xl text-[#A0522D]"></i><h2 class="font-semibold text-lg mt-4">No orders yet</h2><a href="./moreproduct.html" class="inline-block mt-4 bg-[#A0522D] text-white px-5 py-2.5 rounded-lg text-sm">Shop Products</a></div>`;
      return;
    }
    list.innerHTML = orders.map((order) => `
      <article class="bg-white rounded-2xl border border-[#ECE4CE] p-5 sm:p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div><p class="text-xs text-stone-500">Order ID</p><p class="font-mono text-xs font-semibold break-all">${escapeHtml(order.razorpayOrderId)}</p></div>
          <div class="flex gap-2"><span class="px-3 py-1 rounded-full text-xs font-bold uppercase bg-stone-100 text-stone-700">${escapeHtml(order.paymentStatus)}</span><span class="px-3 py-1 rounded-full text-xs font-bold uppercase bg-[#E8F3EC] text-[#1F7A55]">${escapeHtml(order.orderStatus)}</span></div>
        </div>
        <div class="py-4 space-y-2">${order.items.map((item) => `<div class="flex justify-between text-sm gap-4"><span>${escapeHtml(item.name)} <span class="text-stone-500">(${escapeHtml(item.variant)}) x ${item.quantity}</span></span><b>${money(item.lineTotal)}</b></div>`).join("")}</div>
        <div class="border-t border-stone-100 pt-4 flex justify-between items-center"><span class="text-xs text-stone-500">${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span><span class="font-bold">Total: ${money(order.totalAmount)}</span></div>
      </article>`).join("");
  } catch (error) {
    loader.innerHTML = `<p class="text-red-600">${escapeHtml(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", loadMyOrders);
