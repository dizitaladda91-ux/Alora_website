import BASE_URL from "./config.js";

const byId = (id) => document.getElementById(id);
const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const registerForm = byId("affiliateRegisterForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = byId("affiliateRegisterMessage");
    const payload = { name: byId("affiliateName").value.trim(), email: byId("affiliateEmail").value.trim(), phone: byId("affiliatePhone").value.trim(), password: byId("affiliatePassword").value };
    try {
      const response = await fetch(`${BASE_URL}/api/affiliates/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      message.textContent = data.message || "Could not create affiliate account.";
      message.className = `mt-4 text-sm ${response.ok ? "text-emerald-700" : "text-red-700"}`;
      if (response.ok) registerForm.reset();
    } catch { message.textContent = "Could not reach the server."; message.className = "mt-4 text-sm text-red-700"; }
  });
}

const dashboard = byId("affiliateDashboard");
if (dashboard) {
  try {
    const response = await fetch(`${BASE_URL}/api/affiliates/dashboard`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Please sign in as an affiliate.");
    const { referral, conversions, summary } = data;
    const link = `${window.location.origin}/?ref=${encodeURIComponent(referral.code)}`;
    byId("affiliateLink").value = link;
    byId("affiliateCode").textContent = `Code: ${referral.code} · Customer discount: ${referral.discountPercent}% · Commission: ${referral.commissionPercent}%`;
    byId("affiliateClicks").textContent = referral.totalClicks;
    byId("affiliateConversions").textContent = referral.totalConversions;
    byId("affiliatePending").textContent = money(summary.pendingCommission);
    byId("affiliateConversionsTable").innerHTML = conversions.length ? conversions.map((item) => `<tr class="border-t"><td class="p-3">${new Date(item.createdAt).toLocaleDateString("en-IN")}</td><td class="p-3">${safe(item.orderId)}</td><td class="p-3">${money(item.orderAmount)}</td><td class="p-3">${money(item.commissionAmount)}</td><td class="p-3 capitalize">${safe(item.status)}</td></tr>`).join("") : '<tr><td colspan="5" class="p-5 text-center text-stone-500">No conversions yet.</td></tr>';
    dashboard.classList.remove("hidden");
    byId("copyAffiliateLink").addEventListener("click", async () => { await navigator.clipboard.writeText(link); byId("copyAffiliateLink").textContent = "Copied"; });
  } catch (error) { byId("affiliateError").textContent = error.message; }
  byId("affiliateLogout").addEventListener("click", async () => { await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" }); window.location.href = "./login.html"; });
}
