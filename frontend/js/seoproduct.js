import BASE_URL, { getImageUrl, safeFetchJson } from './config.js';
const table = document.getElementById('seo-product-table');
function escapeHtml(value = '') {
    const element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
}
async function loadProducts() {
    try {
        const products = await safeFetchJson(`${BASE_URL}/api/product/all`);
        if (!products.length) {
            table.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-gray-400">No products found.</td></tr>';
            return;
        }
        table.innerHTML = products.map(product => `
            <tr class="hover:bg-gray-50/70">
                <td class="px-6 py-4"><div class="flex items-center gap-3"><img class="h-12 w-12 rounded-lg object-cover border" src="${getImageUrl(product.imagepath, './static/alora image 2.jpeg')}" alt="" onerror="this.src='./static/alora image 2.jpeg'"><span class="font-bold text-gray-800">${escapeHtml(product.name)}</span></div></td>
                <td class="px-6 py-4 text-gray-600 max-w-xs"><p class="line-clamp-2">${escapeHtml(product.description || '')}</p></td>
                <td class="px-6 py-4"><span class="text-amber-600 font-bold"><i class="fa-solid fa-star"></i> ${product.rating ?? 4.5}</span></td>
                <td class="px-6 py-4 text-gray-600">${(product.variants || []).map(v => escapeHtml(v.volume)).join(', ') || '—'}</td>
                <td class="px-6 py-4 text-right"><a class="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold" href="./seoproductupdate.html?id=${product._id}"><i class="fa-solid fa-pen-to-square"></i> Edit allowed fields</a></td>
            </tr>`).join('');
    } catch (error) {
        table.innerHTML = `<tr><td colspan="5" class="px-6 py-10 text-center text-red-600">Could not load products: ${escapeHtml(error.message)}</td></tr>`;
    }
}
document.addEventListener('DOMContentLoaded', loadProducts);