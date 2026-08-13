import BASE_URL, { getAuthHeaders } from "./config.js";

/**
 * 1. Reusable template helper for dynamic variant markup rows.
 * Added Combo Options ('Combo', 'Pack of 2', 'Pack of 3', 'Kit') to the volume selection.
 */
function getVariantRowHTML(isFirstRow = false) {
    return `
        <div>
            ${isFirstRow ? `<label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Volume / Type</label>` : ''}
            <select class="v-volume w-full px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-xs focus:outline-none focus:border-amber-700">
                 <option value="50g">50g</option>
                 <option value="100g">100g</option>
                 <option value="30ml">30ml</option>
                 <option value="100ml">100ml</option>
                 <option value="200ml" selected>200ml</option>
                 <option value="500ml">500ml</option>
                 <option value="Combo">Combo Offer</option>
                 <option value="Pack of 2">Pack of 2</option>
                 <option value="Pack of 3">Pack of 3</option>
                 <option value="Kit">Skincare Kit</option>
            </select>
        </div>
        <div>
            ${isFirstRow ? `<label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Offer Price (₹)</label>` : ''}
            <input type="number" min="0" placeholder="e.g. 1399" class="v-price w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-700" required>
        </div>
        <div>
            ${isFirstRow ? `<label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">MRP Price (₹)</label>` : ''}
            <input type="number" min="0" placeholder="e.g. 1598" class="v-comparePrice w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-700">
        </div>
        <div class="flex items-center gap-2">
            <div class="w-full">
                ${isFirstRow ? `<label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Stock</label>` : ''}
                <input type="number" min="0" value="10" class="v-stock w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-700" required>
            </div>
            <button type="button" onclick="removeVariantRow(this)" class="text-red-400 hover:text-red-600 p-1 transition ${isFirstRow ? 'mt-5 opacity-0 pointer-events-none' : 'mt-1.5'}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
}

/**
 * 2. Injects a clean variant layout template into the container.
 */
function addVariantRow() {
    const container = document.getElementById("variantsContainer");
    const newRow = document.createElement("div");
    
    newRow.className = "variant-row grid grid-cols-4 gap-3 items-end bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative animate__animated animate__fadeInUp animate__faster";
    newRow.innerHTML = getVariantRowHTML(false);
    
    container.appendChild(newRow);
}

/**
 * 3. Removes the target variation element block.
 */
function removeVariantRow(button) {
    const rows = document.querySelectorAll('.variant-row');
    if (rows.length > 1) {
        const row = button.closest('.variant-row');
        if (row) {
            row.remove();
        }
    } else {
        alert("At least one variant is required!");
    }
}

// Expose handlers globally
window.addVariantRow = addVariantRow;
window.removeVariantRow = removeVariantRow;

/**
 * 4. Intercepts submission lifecycle and handles network safely.
 */
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const formElement = e.target;
    const submitButton = formElement.querySelector('button[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerText = "Saving Product...";
    }

    const formData = new FormData(formElement);
    const variantRows = document.querySelectorAll('.variant-row');
    const variantsArray = [];

    variantRows.forEach(row => {
        const volume = row.querySelector('.v-volume').value;
        const price = row.querySelector('.v-price').value;
        const comparePrice = row.querySelector('.v-comparePrice').value;
        const stock = row.querySelector('.v-stock').value;

        if (volume && price) {
            variantsArray.push({
                volume: volume,
                price: Number(price),
                comparePrice: comparePrice ? Number(comparePrice) : undefined,
                stock: stock ? Number(stock) : 10
            });
        }
    });

    formData.append('variants', JSON.stringify(variantsArray));

    try {
        const response = await fetch(`${BASE_URL}/api/product/add`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData 
        });

        const data = await response.json();

        if (response.ok) {
            alert('Product successfully added!');
            formElement.reset();
            
            // Variants container ko reset karke single default row set karna
            const container = document.getElementById("variantsContainer");
            container.innerHTML = "";
            
            const initialRow = document.createElement("div");
            initialRow.className = "variant-row grid grid-cols-4 gap-3 items-end bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative";
            initialRow.innerHTML = getVariantRowHTML(true);
            container.appendChild(initialRow);

            if (typeof window.loadProducts === 'function') {
                window.loadProducts();
            } else if (typeof loadProducts === 'function') {
                loadProducts();
            }

        } else {
            alert('Error: ' + (data.error || 'Failed to add the product.'));
        }
    } catch (err) {
        console.error('Submission processing failure:', err);
        alert('Server Failed to connect!');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerText = "Save Product With Variants";
        }
    }
});
