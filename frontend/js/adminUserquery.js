import BASE_URL, { getAuthHeaders } from "./config.js";




let allQueries = [];
let currentPage = 1;
const rowsPerPage = 5; // Ek page par kitni queries dikhani hain

// DOM Elements
const tableBody = document.getElementById('leads-table-body');
const emptyState = document.getElementById('empty-state');
const paginationStatus = document.getElementById('pagination-status');
const paginationContainer = document.getElementById('pagination-container');

// 1. Backend se Queries Fetch karne ka function
async function fetchQueries() {
    try {
        // Shuru me table body me loader ya "Loading..." dikhane ke liye
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

// 2. Table me data display/render karne ka function
function renderTable() {
    // Agar koi query nahi milti tab Empty State active hoga
    if (allQueries.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        paginationStatus.innerText = "Showing 0 to 0 of 0 entries";
        paginationContainer.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');

    // Pagination calculations (kis index se kis index tak data dikhana hai)
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, allQueries.length);
    const paginatedItems = allQueries.slice(startIndex, endIndex);

    // HTML Table Rows Generation
    tableBody.innerHTML = paginatedItems.map(query => {
        // Date ko clean format me lane ke liye
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

    // Update bottom entry text info
    paginationStatus.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${allQueries.length} entries`;

    // Render Bottom Pagination Controls
    renderPaginationControls();
}

// 3. Dynamic Pagination Buttons control block
function renderPaginationControls() {
    const totalPages = Math.ceil(allQueries.length / rowsPerPage);
    let buttonsHTML = '';

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    // --- Previous Button ---
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

    // --- Number Buttons ---
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

    // --- Next Button ---
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

// 4. Page change karne ka global function
window.changePage = function(pageNumber) {
    const totalPages = Math.ceil(allQueries.length / rowsPerPage);
    if (pageNumber < 1 || pageNumber > totalPages) return;
    
    currentPage = pageNumber;
    renderTable();
};

// DOM load hote hi operation trigger karein
document.addEventListener('DOMContentLoaded', fetchQueries);
