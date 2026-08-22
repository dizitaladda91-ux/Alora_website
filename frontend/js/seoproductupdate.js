import BASE_URL, { getAuthHeaders, getImageUrl } from './config.js';

const productId = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('seo-product-form');
if (!productId) window.location.replace('./seoproduct.html');

const faqContainer = document.getElementById('product-faq-container');
const addFaqBtn = document.getElementById('add-product-faq-btn');

function createFaqRow(question = '', answer = '') {
    const row = document.createElement('div');
    row.className = 'faq-row p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 relative group';
    row.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider font-mono">FAQ Question & Answer</span>
            <button type="button" class="remove-faq-btn text-rose-500 hover:text-rose-700 text-xs font-bold transition flex items-center gap-1">
                <i class="fa-solid fa-trash-can"></i> Remove
            </button>
        </div>
        <input type="text" class="faq-question w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none text-xs text-slate-800 font-semibold" placeholder="Question (e.g. Can I use the Face Wash every day?)" value="${escapeHtml(question)}" />
        <textarea rows="2" class="faq-answer w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none text-xs text-slate-800" placeholder="Answer (e.g. Yes! Our Face Wash is dermatologist-formulated...)">${escapeHtml(answer)}</textarea>
    `;

    row.querySelector('.remove-faq-btn').addEventListener('click', () => {
        row.remove();
    });

    return row;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (addFaqBtn && faqContainer) {
    addFaqBtn.addEventListener('click', () => {
        faqContainer.appendChild(createFaqRow());
    });
}

function getCollectedProductFaqs() {
    const faqs = [];
    if (!faqContainer) return faqs;
    const rows = faqContainer.querySelectorAll('.faq-row');
    rows.forEach(row => {
        const q = row.querySelector('.faq-question')?.value.trim();
        const a = row.querySelector('.faq-answer')?.value.trim();
        if (q && a) {
            faqs.push({ question: q, answer: a });
        }
    });
    return faqs;
}

async function loadProduct() {
    try {
        const response = await fetch(`${BASE_URL}/api/product/${productId}`);
        const product = await response.json();
        if (!response.ok) throw new Error(product.error || 'Product load failed');
        document.getElementById('product-name').textContent = product.name;
        form.description.value = product.description || '';
        if (form.videoUrl) form.videoUrl.value = product.videoUrl || '';
        form.rating.value = product.rating ?? 4.5;
        const preview = document.getElementById('image-preview');
        preview.src = getImageUrl(product.imagepath, './static/alora image 2.jpeg'); 
        preview.classList.remove('hidden');

        document.getElementById('volumes').innerHTML = (product.variants || []).map((variant, index) => 
            `<input aria-label="Measurement ${index + 1}" value="${escapeHtml(String(variant.volume))}" required class="seo-volume w-full rounded-lg border border-gray-300 p-3 text-sm">`
        ).join('');

        if (Array.isArray(product.faqs) && product.faqs.length > 0 && faqContainer) {
            faqContainer.innerHTML = '';
            product.faqs.forEach(faq => {
                faqContainer.appendChild(createFaqRow(faq.question, faq.answer));
            });
        }
    } catch (error) { 
        alert(error.message); 
        window.location.replace('./seoproduct.html'); 
    }
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); 
    button.disabled = true; 
    button.textContent = 'Saving...';
    
    const data = new FormData(form);
    data.append('volumes', JSON.stringify([...document.querySelectorAll('.seo-volume')].map(input => input.value)));
    data.append('faqs', JSON.stringify(getCollectedProductFaqs()));
    
    try {
        const response = await fetch(`${BASE_URL}/api/product/seo-update/${productId}`, { 
            method: 'PUT', 
            headers: getAuthHeaders(), 
            credentials: 'include', 
            body: data 
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.message || 'Update failed');
        alert('Product updated successfully.'); 
        window.location.href = './seoproduct.html';
    } catch (error) { 
        alert(error.message); 
        button.disabled = false; 
        button.textContent = 'Save Product Changes'; 
    }
});

document.addEventListener('DOMContentLoaded', loadProduct);
