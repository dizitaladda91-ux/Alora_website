import BASE_URL, { getImageUrl, getAuthHeaders, safeFetchJson } from "./config.js";

async function loadAllProducts(){
    const tbody = document.getElementById("productTableBody");
    if (!tbody) return; // Guard clause: Agar target table page par na ho toh execution block karein.

    try {
        const products = await safeFetchJson(`${BASE_URL}/api/product/all`);

        if(products.length === 0){
            tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center text-gray-400 font-medium">
                    No products found in database. Click "Add New Product" above to create one.
                </td>
            </tr>`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const fullImgUrl = getImageUrl(p.imagepath, './static/alora image 2.jpeg');
            
            // ✅ FIXED: Safe Base64 encoding without relying on deprecated escape/unescape methods
            const productDataStr = btoa(encodeURIComponent(JSON.stringify(p)));
            
            // 1. Process multiple volumes listing pills
            let volumesHTML = '-';
            let startingPrice = '0';
            let totalStock = 0;

            if(p.variants && p.variants.length > 0) {
                volumesHTML = p.variants.map(v => `
                    <span class="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-gray-200/60">
                        ${v.volume}
                    </span>
                `).join(' ');

                // Starting price calculation
                const prices = p.variants.map(v => v.price);
                startingPrice = Math.min(...prices);

                // Calculate total stock
                totalStock = p.variants.reduce((acc, curr) => acc + curr.stock, 0);
            }

            // 2. Aggregate Stock Status Logic
            const stockBadge = p.isAvailable && totalStock > 0 
                ? `<span class="bg-green-50 text-green-700 border border-green-200 text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>In Stock (${totalStock})</span>`
                : `<span class="bg-red-50 text-red-700 border border-red-200 text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Out of Stock</span>`;

            // String parsing template injection safely protected inside data attribute
            return `
            <tr class="hover:bg-gray-50/75 transition duration-150">
                <td class="px-6 py-4 flex items-center gap-3">
                    <img src="${fullImgUrl}" alt="${p.name}" class="h-12 w-12 object-cover rounded-xl border border-gray-200 shadow-sm flex-shrink-0" onerror="this.src='./static/alora image 2.jpeg';">
                    <div class="max-w-[180px]">
                        <p class="font-bold text-gray-800 truncate">${p.name}</p>
                        <p class="text-xs text-gray-400 truncate mt-0.5">${p.description || 'No description added'}</p>
                    </div>
                </td>
                <td class="px-6 py-4 text-xs font-semibold text-gray-600">${p.batchNumber || 'N/A'}</td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1 max-w-[150px]">
                        ${volumesHTML}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-base font-extrabold text-[#a35242]">₹${startingPrice}<span class="text-[10px] text-gray-400 font-normal"> up</span></div>
                </td>
                <td class="px-6 py-4">${stockBadge}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-1 text-amber-500 font-bold text-xs bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg w-max">
                        <i class="fa-solid fa-star"></i> ${p.rating || '4.5'}
                    </div>
                </td>
                <td class="px-6 py-4 space-x-2 whitespace-nowrap">
                    <button data-info="${productDataStr}" onclick="viewProduct(this)" class="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-2.5 py-1.5 rounded-lg transition">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button onclick="deleteProduct('${p._id}')" class="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 px-2.5 py-1.5 rounded-lg transition">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-3">
                    <a href="./adminupdateproduct.html?id=${p._id}" class="text-blue-600 hover:text-blue-900 transition bg-blue-50 p-2 rounded-lg border border-blue-200">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </a>
                </td>
            </tr>
            `;                     
        }).join(" ");

    } catch (error) {
        console.error("Fetch error:", error);
        tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-6 text-center text-red-500 font-semibold">
                Error: ${error.message}. Backend check karein!
            </td>   
        </tr>`;
    }
}

function viewProduct(button){
    try {
        const base64Data = button.getAttribute("data-info");
        // ✅ FIXED: Safe Decoding complement matching the modern approach
        const product = JSON.parse(decodeURIComponent(atob(base64Data)));
        
        document.getElementById('modalImg').src = getImageUrl(product.imagepath, './static/alora image 2.jpeg');
        document.getElementById('modalImg').alt = product.name;
        document.getElementById('modalName').innerText = product.name;
        document.getElementById('modalBadge').innerText = product.batchNumber || 'N/A';
        document.getElementById('modalDesc').innerText = product.description || 'No description provided.';
        document.getElementById('modalRating').innerText = `${product.rating || '4.5'} Stars`;
        document.getElementById('modalReviews').innerText = `Based on ${product.totalReviews || 0} customer reviews`;

        const variantsBody = document.getElementById('modalVariantsBody');
        let totalStockLeft = 0;

        if (product.variants && product.variants.length > 0) {
            variantsBody.innerHTML = product.variants.map(v => {
                totalStockLeft += v.stock;
                return `
                    <tr class="hover:bg-gray-50/50 transition">
                        <td class="px-4 py-2 font-bold text-gray-700">${v.volume}</td>
                        <td class="px-4 py-2 font-extrabold text-[#a35242]">₹${v.price}</td>
                        <td class="px-4 py-2 text-gray-400 line-through">${v.comparePrice ? '₹' + v.comparePrice : '-'}</td>
                        <td class="px-4 py-2 font-semibold ${v.stock > 0 ? 'text-green-600' : 'text-red-500'}">${v.stock} units</td>
                    </tr>
                `;
            }).join('');
        } else {
            variantsBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-400">No variants available</td></tr>`;
        }

        const badge = document.getElementById('modalBadge');
        if(product.isAvailable && totalStockLeft > 0) {
            badge.innerText = "Active";
            badge.className = "absolute top-4 right-4 text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full shadow-sm bg-green-500 text-white";
        } else {
            badge.innerText = "Out of Stock";
            badge.className = "absolute top-4 right-4 text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full shadow-sm bg-red-500 text-white";
        }

        const modal = document.getElementById('productModal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);

    } catch (e) {
        console.error("Parsing error inside viewProduct:", e);
    }
}

function closeModal() {
    const modal = document.getElementById('productModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

async function deleteProduct(productId) {
    if(!confirm("Kya aap sach me is product ko delete karna chahte hain?")){
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/api/product/delete/${productId}`,{
            method:"DELETE",
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        const result = await response.json();
        if(response.ok){
            alert("Product successfully delete ");
            // ✅ State update crash se bachne ke liye safe execution loop execution
            loadAllProducts();
        }else{
            alert("Error: "+ (result.message || "Failed to delete"));
        }
    } catch (error) {
        console.error("Delete error: ", error);
        alert("Could not connect to the server.");
    }
}

// --- GLOBAL SCOPE FIX FOR MODULES ---
window.viewProduct = viewProduct;
window.closeModal = closeModal;
window.deleteProduct = deleteProduct;
window.loadAllProducts = loadAllProducts; // Modularity control ke liye explicit call inject kiya

document.addEventListener('DOMContentLoaded', loadAllProducts);
