import BASE_URL, { getAuthHeaders } from "./config.js";

let allFaqs = [];
let activeFilter = "all";

const faqTableBody = document.getElementById("faq-table-body");
const faqCountEl = document.getElementById("faqCount");
const faqSearchInput = document.getElementById("faqSearchInput");
const faqModal = document.getElementById("faqModal");
const faqForm = document.getElementById("faqForm");
const modalTitle = document.getElementById("modalTitle");
const addNewFaqBtn = document.getElementById("addNewFaqBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const copySchemaBtn = document.getElementById("copySchemaBtn");

// Form Fields
const faqIdInput = document.getElementById("faqId");
const faqQuestionInput = document.getElementById("faqQuestion");
const faqAnswerInput = document.getElementById("faqAnswer");
const faqOrderInput = document.getElementById("faqOrder");
const faqCategoryInput = document.getElementById("faqCategory");
const faqIsActiveInput = document.getElementById("faqIsActive");

// 🟢 1. FETCH ALL FAQS
async function fetchFaqs() {
    try {
        if (faqTableBody) {
            faqTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                        <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-amber-600"></i>
                        <p class="text-xs font-semibold">Loading FAQs from database...</p>
                    </td>
                </tr>
            `;
        }

        const res = await fetch(`${BASE_URL}/api/faqs/admin`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}`);
        }

        const data = await res.json();
        allFaqs = data.data || [];
        updateFilterCounts();
        applyFiltersAndRender();
    } catch (error) {
        console.error("Failed to load FAQs:", error);
        if (faqTableBody) {
            faqTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center text-rose-500">
                        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                        <p class="text-xs font-bold">Failed to load FAQs. Please make sure you are logged in as SEO Admin.</p>
                    </td>
                </tr>
            `;
        }
    }
}

// 🟢 2. UPDATE CATEGORY FILTER COUNTS
function updateFilterCounts() {
    const counts = {
        all: allFaqs.length,
        landing: 0,
        about: 0,
        shop: 0,
        blog: 0,
        track: 0,
        general: 0
    };

    allFaqs.forEach(f => {
        const cat = (f.category || "General").toLowerCase();
        if (cat.includes("landing") || cat.includes("home")) counts.landing++;
        else if (cat.includes("about")) counts.about++;
        else if (cat.includes("shop") || cat.includes("product")) counts.shop++;
        else if (cat.includes("blog") || cat.includes("post")) counts.blog++;
        else if (cat.includes("track") || cat.includes("support") || cat.includes("order")) counts.track++;
        else counts.general++;
    });

    const setBadge = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setBadge("count-all", counts.all);
    setBadge("count-landing", counts.landing);
    setBadge("count-about", counts.about);
    setBadge("count-shop", counts.shop);
    setBadge("count-blog", counts.blog);
    setBadge("count-track", counts.track);
    setBadge("count-general", counts.general);
}

// 🟢 3. GET CATEGORY BADGE HTML
function getCategoryBadge(category) {
    const raw = (category || "General").trim();
    const cat = raw.toLowerCase();

    if (cat.includes("landing") || cat.includes("home")) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300 font-mono shadow-xs">🏠 Landing Page</span>`;
    }
    if (cat.includes("about")) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100/90 text-sky-900 border border-sky-300 font-mono shadow-xs">ℹ️ About Us</span>`;
    }
    if (cat.includes("shop") || cat.includes("product")) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-900 border border-emerald-300 font-mono shadow-xs">🛍️ Shop / Products</span>`;
    }
    if (cat.includes("blog") || cat.includes("post")) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100/90 text-purple-900 border border-purple-300 font-mono shadow-xs">📝 Blog Page</span>`;
    }
    if (cat.includes("track") || cat.includes("support") || cat.includes("order")) {
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100/90 text-indigo-900 border border-indigo-300 font-mono shadow-xs">📦 Track &amp; Support</span>`;
    }
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300 font-mono shadow-xs">🌐 General / All Pages</span>`;
}

// 🟢 4. FILTER AND RENDER
function applyFiltersAndRender() {
    const searchVal = (faqSearchInput ? faqSearchInput.value : "").toLowerCase().trim();

    let filtered = allFaqs.filter(f => {
        // Page filter
        if (activeFilter !== "all") {
            const cat = (f.category || "General").toLowerCase();
            const target = activeFilter.toLowerCase();
            if (target === "general" && !cat.includes("general") && !cat.includes("all")) return false;
            if (target === "landing page" && !cat.includes("landing") && !cat.includes("home")) return false;
            if (target === "about us" && !cat.includes("about")) return false;
            if (target === "shop / products" && !cat.includes("shop") && !cat.includes("product")) return false;
            if (target === "blog page" && !cat.includes("blog") && !cat.includes("post")) return false;
            if (target === "track order / support" && !cat.includes("track") && !cat.includes("order") && !cat.includes("support")) return false;
        }

        // Search filter
        if (searchVal) {
            const q = (f.question || "").toLowerCase();
            const a = (f.answer || "").toLowerCase();
            const c = (f.category || "").toLowerCase();
            return q.includes(searchVal) || a.includes(searchVal) || c.includes(searchVal);
        }

        return true;
    });

    renderFaqs(filtered);
}

// 🟢 5. RENDER FAQS TABLE
function renderFaqs(faqsToRender) {
    if (faqCountEl) faqCountEl.innerText = faqsToRender.length;

    if (!faqTableBody) return;

    if (!faqsToRender || faqsToRender.length === 0) {
        faqTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs font-bold text-slate-600">No FAQs found for this page.</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Click "Add New FAQ" to create a question for this page.</p>
                </td>
            </tr>
        `;
        return;
    }

    faqTableBody.innerHTML = faqsToRender.map((faq, index) => {
        const id = faq._id;
        const q = escapeHtml(faq.question || "");
        const rawAns = faq.answer || "";
        const cleanAns = escapeHtml(rawAns.length > 120 ? rawAns.substring(0, 120) + "..." : rawAns);
        const order = faq.order || (index + 1);
        const categoryBadge = getCategoryBadge(faq.category);
        const isActive = faq.isActive !== false;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                <td class="px-6 py-4 text-center font-mono font-bold text-slate-400 text-xs">
                    ${order}
                </td>
                <td class="px-6 py-4">
                    <div class="mb-1.5">
                        ${categoryBadge}
                    </div>
                    <h4 class="font-bold text-slate-900 text-sm leading-snug">
                        ${q}
                    </h4>
                </td>
                <td class="px-6 py-4 text-slate-600 text-xs leading-relaxed max-w-xs">
                    ${cleanAns}
                </td>
                <td class="px-6 py-4 text-center">
                    ${isActive 
                        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300 uppercase font-mono shadow-xs">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                        </span>`
                        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 uppercase font-mono">
                            Inactive
                        </span>`
                    }
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-2">
                        <button type="button" onclick="window.editFaq('${id}')" class="p-2 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 transition shadow-xs cursor-pointer" title="Edit FAQ">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                        <button type="button" onclick="window.deleteFaq('${id}')" class="p-2 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 transition shadow-xs cursor-pointer" title="Delete FAQ">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// 🟢 6. OPEN MODAL (ADD / EDIT)
function openModal(faq = null) {
    if (faq) {
        modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-400"></i> Edit FAQ`;
        faqIdInput.value = faq._id;
        faqQuestionInput.value = faq.question || "";
        faqAnswerInput.value = faq.answer || "";
        faqOrderInput.value = faq.order || 1;
        faqCategoryInput.value = faq.category || "General";
        faqIsActiveInput.checked = faq.isActive !== false;
    } else {
        modalTitle.innerHTML = `<i class="fa-solid fa-circle-question text-amber-400"></i> Add New FAQ`;
        faqForm.reset();
        faqIdInput.value = "";
        
        // Pre-select category based on active filter if not 'all'
        if (activeFilter && activeFilter !== "all") {
            faqCategoryInput.value = activeFilter;
        } else {
            faqCategoryInput.value = "Landing Page";
        }
        
        // Compute order for this category
        const existingInCat = allFaqs.filter(f => (f.category || "").toLowerCase() === (faqCategoryInput.value || "").toLowerCase());
        faqOrderInput.value = existingInCat.length + 1;
        faqIsActiveInput.checked = true;
    }
    faqModal.classList.remove("hidden");
}

function closeModal() {
    faqModal.classList.add("hidden");
    faqForm.reset();
}

// 🟢 7. SAVE FAQ (SUBMIT FORM)
async function handleSaveFaq(e) {
    e.preventDefault();
    const id = faqIdInput.value.trim();
    const isEdit = Boolean(id);

    const payload = {
        question: faqQuestionInput.value.trim(),
        answer: faqAnswerInput.value.trim(),
        order: Number(faqOrderInput.value) || 1,
        category: faqCategoryInput.value.trim() || "General",
        isActive: faqIsActiveInput.checked
    };

    const saveBtn = document.getElementById("saveFaqBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    try {
        const url = isEdit ? `${BASE_URL}/api/faqs/${id}` : `${BASE_URL}/api/faqs`;
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: {
                ...getAuthHeaders(),
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to save FAQ");
        }

        closeModal();
        await fetchFaqs();
        alert(isEdit ? "FAQ updated successfully!" : "FAQ created successfully!");
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// 🟢 8. GLOBAL ACTIONS (EDIT / DELETE)
window.editFaq = function(id) {
    const faq = allFaqs.find(f => f._id === id);
    if (faq) {
        openModal(faq);
    }
};

window.deleteFaq = async function(id) {
    if (!confirm("Are you sure you want to permanently delete this FAQ?")) return;

    try {
        const res = await fetch(`${BASE_URL}/api/faqs/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to delete FAQ");
        }

        await fetchFaqs();
        alert("FAQ deleted successfully!");
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
};

// 🟢 9. COPY JSON-LD SCHEMA
function copySchema() {
    const activeFaqs = allFaqs.filter(f => f.isActive !== false);
    const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": activeFaqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f.answer.replace(/<[^>]*>/g, "")
            }
        }))
    };

    const str = JSON.stringify(schema, null, 2);
    navigator.clipboard.writeText(str).then(() => {
        alert("FAQPage JSON-LD Schema copied to clipboard!");
    }).catch(() => {
        prompt("Copy Schema JSON:", str);
    });
}

// 🟢 10. SETUP FILTER TABS
function initFilterTabs() {
    const filterBtns = document.querySelectorAll(".faq-filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => {
                b.classList.remove("active", "bg-slate-900", "text-white", "font-extrabold");
                b.classList.add("bg-white", "text-slate-700", "font-bold");
                const countBadge = b.querySelector(".filter-count");
                if (countBadge) {
                    countBadge.classList.remove("bg-slate-800", "text-slate-300");
                    countBadge.classList.add("bg-slate-100", "text-slate-600");
                }
            });

            btn.classList.add("active", "bg-slate-900", "text-white", "font-extrabold");
            btn.classList.remove("bg-white", "text-slate-700", "font-bold");
            const countBadge = btn.querySelector(".filter-count");
            if (countBadge) {
                countBadge.classList.add("bg-slate-800", "text-slate-300");
                countBadge.classList.remove("bg-slate-100", "text-slate-600");
            }

            activeFilter = btn.dataset.filter || "all";
            applyFiltersAndRender();
        });
    });
}

// 🟢 11. SEARCH
if (faqSearchInput) {
    faqSearchInput.addEventListener("input", applyFiltersAndRender);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event Listeners
if (addNewFaqBtn) addNewFaqBtn.addEventListener("click", () => openModal(null));
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);
if (faqForm) faqForm.addEventListener("submit", handleSaveFaq);
if (copySchemaBtn) copySchemaBtn.addEventListener("click", copySchema);

document.addEventListener("DOMContentLoaded", () => {
    initFilterTabs();
    fetchFaqs();
});
