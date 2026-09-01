import BASE_URL from "./config.js";
let allLeads = []; 
let currentPage = 1;
const itemsPerPage = 5; 
function formatLeadDate(createdAtString) {
    const date = new Date(createdAtString);
    const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const formattedDate = date.toLocaleDateString('en-IN', dateOptions);
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const formattedTime = date.toLocaleTimeString('en-IN', timeOptions);
    return { formattedDate, formattedTime };
}
function renderLeadsTable() {
    const tableBody = document.getElementById("leads-table-body");
    const emptyState = document.getElementById("empty-state");
    const paginationWrapper = document.getElementById("pagination-wrapper");
    if (!allLeads || allLeads.length === 0) {
        tableBody.innerHTML = "";
        emptyState.classList.remove("hidden");
        paginationWrapper.classList.add("hidden");
        return;
    }
    emptyState.classList.add("hidden");
    paginationWrapper.classList.remove("hidden");
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLeads = allLeads.slice(startIndex, endIndex);
    const tableRowsHtml = paginatedLeads.map(lead => {
        const initials = lead.name 
            ? lead.name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase() 
            : "LD";
        const { formattedDate, formattedTime } = formatLeadDate(lead.createdAt);
        return `
            <tr class="hover:bg-stone-50/50 transition border-b border-gray-100">
                <!-- 1. Name & ID -->
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-700 uppercase">
                            ${initials}
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-900 text-sm tracking-wide">${lead.name}</h4>
                            <span class="text-[10px] text-gray-400 font-mono font-medium block mt-0.5">ID: ${lead._id}</span>
                        </div>
                    </div>
                </td>
                <!-- 2. Email Address -->
                <td class="py-4 px-6">
                    <div class="flex items-center gap-1.5 text-gray-600 text-xs font-medium">
                        <i class="fa-regular fa-envelope text-gray-400"></i>
                        ${lead.email}
                    </div>
                </td>
                <!-- 3. Joined Date & Time -->
                <td class="py-4 px-6 text-xs text-gray-500 font-medium">
                    <div>${formattedDate}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">${formattedTime}</div>
                </td>
            </tr>
        `;
    }).join("");
    tableBody.innerHTML = tableRowsHtml;
    const actualEndIndex = Math.min(endIndex, allLeads.length);
    document.getElementById("pagination-status").innerText = 
        `Showing ${allLeads.length > 0 ? startIndex + 1 : 0} to ${actualEndIndex} of ${allLeads.length} entries`;
    renderPaginationControls();
}
function renderPaginationControls() {
    const container = document.getElementById("pagination-container");
    const totalPages = Math.ceil(allLeads.length / itemsPerPage);
    let html = "";
    const prevDisabled = currentPage === 1;
    html += `
        <li>
            <button ${prevDisabled ? 'disabled' : ''} 
                class="prev-btn flex items-center justify-center px-3 h-9 leading-tight text-gray-500 bg-white border-r border-gray-200 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                Previous
            </button>
        </li>
    `;
    for (let i = 1; i <= totalPages; i++) {
        const isCurrent = i === currentPage;
        html += `
            <li>
                <button class="page-num-btn flex items-center justify-center px-3 h-9 leading-tight border-r border-gray-200 transition-colors
                    ${isCurrent 
                        ? 'bg-gray-800 text-white hover:bg-gray-900 border-gray-800' 
                        : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }" 
                    data-page="${i}">
                    ${i}
                </button>
            </li>
        `;
    }
    const nextDisabled = currentPage === totalPages || totalPages === 0;
    html += `
        <li>
            <button ${nextDisabled ? 'disabled' : ''} 
                class="next-btn flex items-center justify-center px-3 h-9 leading-tight text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                Next
            </button>
        </li>
    `;
    container.innerHTML = html;
    container.querySelectorAll(".page-num-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            currentPage = Number(btn.getAttribute("data-page"));
            renderLeadsTable();
        });
    });
    const prevBtn = container.querySelector(".prev-btn");
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                renderLeadsTable();
            }
        });
    }
    const nextBtn = container.querySelector(".next-btn");
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderLeadsTable();
            }
        });
    }
}
async function loadLeads() {
    try {
        const response = await fetch(`${BASE_URL}/api/lead`, {
            method: "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (!response.ok) {
            throw new Error("Leads data fetch karne me dikkat aa rahi hai");
        }
        const leadsData = await response.json();
        allLeads = leadsData.data || [];
        currentPage = 1;
        renderLeadsTable();
    } catch (error) {
        console.error("Fetch Error:", error);
        const tableBody = document.getElementById("leads-table-body");
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="p-8 text-center text-red-500 text-xs font-semibold">
                        <i class="fa-solid fa-triangle-exclamation mr-2"></i> Server se connect nahi ho paye ya data error mila.
                    </td>
                </tr>
            `;
        }
        document.getElementById("pagination-wrapper").classList.add("hidden");
    }
}
document.addEventListener("DOMContentLoaded", loadLeads);