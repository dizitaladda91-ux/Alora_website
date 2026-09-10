import BASE_URL, { getAuthHeaders } from "./config.js";
let allQueries = [];
let currentPage = 1;
const rowsPerPage = 5; 
const tableBody = document.getElementById('leads-table-body');
const emptyState = document.getElementById('empty-state');
const paginationStatus = document.getElementById('pagination-status');
const paginationContainer = document.getElementById('pagination-container');
async function fetchQueries() {
    try {
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-500 font-medium">Loading queries...</td></tr>`;
        const response = await fetch(`${BASE_URL}/api/queries`, { headers: getAuthHeaders(), credentials: 'include' });
        const result = await response.json();
        if (result.success) {
            allQueries = result.data;
            renderTable();
        } else {
            throw new Error(result.message || "Data fetch nahi ho paya.");
        }
    } catch (error) {
        console.error("Error fetching queries:", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-red-500 font-medium">Error: ${error.message}</td></tr>`;
    }
}
function renderTable() {
    if (allQueries.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        paginationStatus.innerText = "Showing 0 to 0 of 0 entries";
        paginationContainer.innerHTML = '';
        return;
    }
    emptyState.classList.add('hidden');
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, allQueries.length);
    const paginatedItems = allQueries.slice(startIndex, endIndex);
    tableBody.innerHTML = paginatedItems.map(query => {
        const formattedDate = new Date(query.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        return `
            <tr class="hover:bg-gray-50/70 transition-colors">
                <td class="py-4 px-6 font-medium text-gray-900">${query.name}</td>
                <td class="py-4 px-6">
                    <div class="flex flex-col">
                        <span class="text-gray-800 font-medium">${query.email}</span>
                        <span class="text-xs text-gray-400 mt-0.5">${formattedDate}</span>
                    </div>
                </td>
                <td class="py-4 px-6 text-gray-600 max-w-xs break-words">${query.message}</td>
            </tr>
        `;
    }).join('');
    paginationStatus.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${allQueries.length} entries`;
    renderPaginationControls();
}
function renderPaginationControls() {
    const totalPages = Math.ceil(allQueries.length / rowsPerPage);
    let buttonsHTML = '';
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    const isPrevDisabled = currentPage === 1;
    buttonsHTML += `
        <li>
            <button 
                onclick="changePage(${currentPage - 1})" 
                ${isPrevDisabled ? 'disabled' : ''} 
                class="px-3 py-2 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
        </li>
    `;
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        const activeClass = isActive 
            ? 'z-10 text-blue-600 bg-blue-50 border-blue-300 hover:bg-blue-100' 
            : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700';
        buttonsHTML += `
            <li>
                <button 
                    onclick="changePage(${i})" 
                    class="px-3 py-2 leading-tight border transition font-semibold ${activeClass}"
                >
                    ${i}
                </button>
            </li>
        `;
    }
    const isNextDisabled = currentPage === totalPages;
    buttonsHTML += `
        <li>
            <button 
                onclick="changePage(${currentPage + 1})" 
                ${isNextDisabled ? 'disabled' : ''} 
                class="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
        </li>
    `;
    paginationContainer.innerHTML = buttonsHTML;
}
window.changePage = function(pageNumber) {
    const totalPages = Math.ceil(allQueries.length / rowsPerPage);
    if (pageNumber < 1 || pageNumber > totalPages) return;
    currentPage = pageNumber;
    renderTable();
};
document.addEventListener('DOMContentLoaded', fetchQueries);