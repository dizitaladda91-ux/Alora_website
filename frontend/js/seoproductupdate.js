import BASE_URL, { getAuthHeaders, getImageUrl } from './config.js';

const productId = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('seo-product-form');
if (!productId) window.location.replace('./seoproduct.html');

async function loadProduct() {
    try {
        const response = await fetch(`${BASE_URL}/api/product/${productId}`);
        const product = await response.json();
        if (!response.ok) throw new Error(product.error || 'Product load failed');
        document.getElementById('product-name').textContent = product.name;
        form.description.value = product.description || '';
        form.rating.value = product.rating ?? 4.5;
        const preview = document.getElementById('image-preview');
        preview.src = getImageUrl(product.imagepath, './static/alora image 2.jpeg'); preview.classList.remove('hidden');
        document.getElementById('volumes').innerHTML = (product.variants || []).map((variant, index) => `<input aria-label="Measurement ${index + 1}" value="${String(variant.volume).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" required class="seo-volume w-full rounded-lg border border-gray-300 p-3 text-sm">`).join('');
    } catch (error) { alert(error.message); window.location.replace('./seoproduct.html'); }
}
form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Saving...';
    const data = new FormData(form);
    data.append('volumes', JSON.stringify([...document.querySelectorAll('.seo-volume')].map(input => input.value)));
    try {
        const response = await fetch(`${BASE_URL}/api/product/seo-update/${productId}`, { method: 'PUT', headers: getAuthHeaders(), credentials: 'include', body: data });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.message || 'Update failed');
        alert('Product updated successfully.'); window.location.href = './seoproduct.html';
    } catch (error) { alert(error.message); button.disabled = false; button.textContent = 'Save allowed changes'; }
});
document.addEventListener('DOMContentLoaded', loadProduct);
