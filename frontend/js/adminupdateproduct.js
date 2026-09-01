import BASE_URL, { getImageUrl, getAuthHeaders } from "./config.js";
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get('id');
if (!productId) {
    alert("Error: Product ID missing in URL!");
    window.location.href = "./adminproduct.html";
}
function createVariantRowHTML(volume = '', price = '', comparePrice = '', stock = '10', canDelete = true) {
    const volumes = ['50g', '100g', '30ml', '100ml', '200ml', '500ml', 'Combo Offer', 'Pack of 2', 'Pack of 3'];
    if (volume && !volumes.includes(volume)) {
        volumes.push(volume);
    }
    let optionsHTML = volumes.map(v => `<option value="${v}" ${v === volume ? 'selected' : ''}>${v}</option>`).join('');
    return `
        <div class="variant-row grid grid-cols-4 gap-3 items-end bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative animate__animated animate__fadeInUp animate__faster">
            <div>
                <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Volume / Type</label>
                <select class="v-volume w-full px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-xs focus:outline-none focus:border-amber-700">${optionsHTML}</select>
            </div>
            <div>
                <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Offer Price (₹)</label>
                <input type="number" min="0" value="${price}" placeholder="e.g. 1399" class="v-price w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-700" required>
            </div>
            <div>
                <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">MRP Price (₹)</label>
                <input type="number" min="0" value="${comparePrice}" placeholder="e.g. 1598" class="v-comparePrice w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-amber-700">
            </div>
            <div class="flex items-center gap-2">
                <button type="button" onclick="removeVariantRow(this)" class="text-red-400 hover:text-red-600 mt-1.5 p-1 transition ${canDelete ? '' : 'opacity-0 pointer-events-none'}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>`;
}
function addVariantRow() {
    const container = document.getElementById("variantsContainer");
    const div = document.createElement('div');
    div.innerHTML = createVariantRowHTML('200ml', '', '', '10', true);
    container.appendChild(div.firstElementChild);
}
function removeVariantRow(button) {
    const row = button.closest('.variant-row');
    if (row) {
        row.remove();
    }
}
window.addVariantRow = addVariantRow;
window.removeVariantRow = removeVariantRow;
async function fetchProductDetails() {
    try {
        const response = await fetch(`${BASE_URL}/api/product/${productId}`);
        const product = await response.json();
        if (!response.ok) throw new Error(product.error || "Data load nahi ho saka");
        document.querySelector('input[name="name"]').value = product.name || '';
        document.querySelector('textarea[name="description"]').value = product.description || '';
        document.querySelector('input[name="rating"]').value = product.rating || 4.5;
        document.querySelector('input[name="totalReviews"]').value = product.totalReviews || 0;
        document.querySelector('select[name="isAvailable"]').value = String(product.isAvailable);
        document.querySelector('input[name="sku"]').value = product.sku || '';
        document.querySelector('textarea[name="ingredients"]').value = product.ingredients || '';
        document.querySelector('textarea[name="benefits"]').value = product.benefits || '';
        document.querySelector('textarea[name="usageInstructions"]').value = product.usageInstructions || '';
        document.querySelector('input[name="metaTitle"]').value = product.metaTitle || '';
        document.querySelector('input[name="metaDescription"]').value = product.metaDescription || '';
        document.querySelector('input[name="isBestseller"]').checked = Boolean(product.isBestseller);
        document.querySelector('input[name="isFeatured"]').checked = Boolean(product.isFeatured);
        if (product.category) {
            const categorySelect = document.querySelector('select[name="category"]');
            if (categorySelect) categorySelect.value = product.category;
        }
        if (product.imagepath) {
            const imgPreview = document.getElementById('currentProductImg');
            if (imgPreview) {
                imgPreview.src = getImageUrl(product.imagepath, './static/alora image 2.jpeg');
                imgPreview.classList.remove('hidden');
            }
            const noImgText = document.getElementById('noImgText');
            if (noImgText) noImgText.classList.add('hidden');
        }
        const container = document.getElementById("variantsContainer");
        if (container) {
            container.innerHTML = ''; 
            if (product.variants && product.variants.length > 0) {
                product.variants.forEach((v, index) => {
                    container.innerHTML += createVariantRowHTML(v.volume, v.price, v.comparePrice || '', v.stock, index !== 0);
                });
            } else {
                container.innerHTML = createVariantRowHTML('Combo Offer', '', '', '10', false);
            }
        }
    } catch (err) {
        console.error(err);
        alert("Data fetch fail: " + err.message);
    }
}
const form = document.getElementById('updateProductForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.set('isBestseller', String(e.target.querySelector('input[name="isBestseller"]').checked));
        formData.set('isFeatured', String(e.target.querySelector('input[name="isFeatured"]').checked));
        const variantRows = document.querySelectorAll('.variant-row');
        const variantsArray = [];
        variantRows.forEach(row => {
            const volume = row.querySelector('.v-volume').value;
            const price = row.querySelector('.v-price').value;
            const comparePrice = row.querySelector('.v-comparePrice').value;
            if (volume && price) {
                variantsArray.push({
                    volume: volume,
                    price: Number(price),
                    comparePrice: comparePrice ? Number(comparePrice) : undefined
                });
            }
        });
        formData.append('variants', JSON.stringify(variantsArray));
        try {
            const response = await fetch(`${BASE_URL}/api/product/update/${productId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData
            });
            const data = await response.json();
            if (response.ok) {
                alert('Product updated successfully!');
                window.location.href = "./adminproduct.html"; 
            } else {
                alert('Update failed: ' + (data.error || 'Server error'));
            }
        } catch (err) {
            console.error(err);
            alert('Server error occurred during update!');
        }
    });
}
document.addEventListener('DOMContentLoaded', fetchProductDetails);
