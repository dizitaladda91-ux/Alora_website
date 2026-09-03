import BASE_URL, { getAuthUploadHeaders, getImageUrl } from './config.js';

const productId = new URLSearchParams(window.location.search).get('id');
const form = document.getElementById('seo-product-form');
if (!productId) window.location.replace('./seoproduct.html');

const faqContainer = document.getElementById('product-faq-container');
const addFaqBtn = document.getElementById('add-product-faq-btn');

// --- State Management ---
let originalMainImage = '';
let removeMainImageFlag = false;

let existingGallery = []; // Array of URLs string
let newGalleryFiles = []; // Array of File objects

let existingVideoUrl = '';
let newVideoFile = null;
let removeVideoFlag = false;

// --- DOM Elements ---
const mainImgInput = document.getElementById('main-image-input');
const mainImgContainer = document.getElementById('main-image-container');
const imagePreview = document.getElementById('image-preview');
const removeMainImgBtn = document.getElementById('remove-main-img-btn');
const mainImgBadge = document.getElementById('main-image-badge');

const galleryInput = document.getElementById('gallery-images-input');
const galleryGrid = document.getElementById('gallery-previews-grid');
const galleryBadge = document.getElementById('gallery-count-badge');

const videoUrlInput = document.getElementById('video-url-input');
const videoFileInput = document.getElementById('product-video-input');
const videoPreviewCard = document.getElementById('video-preview-card');
const videoPlayer = document.getElementById('video-player-preview');
const videoPlaceholder = document.getElementById('video-placeholder-icon');
const videoFilename = document.getElementById('video-filename');
const videoSubtext = document.getElementById('video-subtext');
const removeVideoBtn = document.getElementById('remove-video-btn');
const videoBadge = document.getElementById('video-status-badge');

// --- Render Main Image UI ---
function renderMainImageUI() {
    if (mainImgInput && mainImgInput.files && mainImgInput.files[0]) {
        const file = mainImgInput.files[0];
        imagePreview.src = URL.createObjectURL(file);
        mainImgContainer.classList.remove('hidden');
        mainImgBadge.textContent = '1 New Selected';
        mainImgBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else if (originalMainImage && !removeMainImageFlag) {
        imagePreview.src = getImageUrl(originalMainImage, './static/placeholder.png');
        mainImgContainer.classList.remove('hidden');
        mainImgBadge.textContent = 'Current Image';
        mainImgBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800';
    } else {
        mainImgContainer.classList.add('hidden');
        mainImgBadge.textContent = removeMainImageFlag ? 'Image Removed' : 'No Image';
        mainImgBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200';
    }
}

if (mainImgInput) {
    mainImgInput.addEventListener('change', () => {
        if (mainImgInput.files && mainImgInput.files[0]) {
            removeMainImageFlag = false;
        }
        renderMainImageUI();
    });
}

if (removeMainImgBtn) {
    removeMainImgBtn.addEventListener('click', () => {
        if (mainImgInput && mainImgInput.files && mainImgInput.files[0]) {
            mainImgInput.value = '';
            renderMainImageUI();
        } else {
            alert("A primary product image is required. Choose a new file to replace it.");
        }
    });
}

// --- Render Gallery UI ---
function renderGalleryUI() {
    if (!galleryGrid || !galleryBadge) return;
    const totalCount = existingGallery.length + newGalleryFiles.length;
    galleryBadge.textContent = `${totalCount} / 6 Images`;
    
    if (totalCount === 0) {
        galleryBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200';
    } else if (totalCount >= 6) {
        galleryBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300';
    } else {
        galleryBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300';
    }

    galleryGrid.innerHTML = '';

    // Render Existing Gallery Images
    existingGallery.forEach((imgUrl, index) => {
        const card = document.createElement('div');
        card.className = 'relative group aspect-square rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center p-1';
        card.innerHTML = `
            <img src="${getImageUrl(imgUrl, './static/placeholder.png')}" alt="Gallery ${index + 1}" class="w-full h-full object-contain rounded-xl">
            <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold">#${index + 1}</span>
            <button type="button" class="remove-existing-gallery-btn absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center shadow-md transition cursor-pointer" title="Remove image">
                &times;
            </button>
        `;
        card.querySelector('.remove-existing-gallery-btn').addEventListener('click', () => {
            existingGallery.splice(index, 1);
            renderGalleryUI();
        });
        galleryGrid.appendChild(card);
    });

    // Render Newly Selected Gallery Files
    newGalleryFiles.forEach((file, index) => {
        const globalIndex = existingGallery.length + index + 1;
        const card = document.createElement('div');
        card.className = 'relative group aspect-square rounded-2xl overflow-hidden bg-emerald-50/50 border border-emerald-300 shadow-sm flex items-center justify-center p-1';
        card.innerHTML = `
            <img src="${URL.createObjectURL(file)}" alt="New Gallery ${index + 1}" class="w-full h-full object-contain rounded-xl">
            <span class="absolute bottom-1 left-1 bg-emerald-700 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md font-bold">#${globalIndex} (New)</span>
            <button type="button" class="remove-new-gallery-btn absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center shadow-md transition cursor-pointer" title="Cancel this file">
                &times;
            </button>
        `;
        card.querySelector('.remove-new-gallery-btn').addEventListener('click', () => {
            newGalleryFiles.splice(index, 1);
            renderGalleryUI();
        });
        galleryGrid.appendChild(card);
    });
}

if (galleryInput) {
    galleryInput.addEventListener('change', (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        for (const file of selectedFiles) {
            if (existingGallery.length + newGalleryFiles.length < 6) {
                newGalleryFiles.push(file);
            } else {
                alert("Maximum 6 gallery images allowed. Please remove existing ones first.");
                break;
            }
        }
        galleryInput.value = ''; // Reset file input so user can add more sequentially
        renderGalleryUI();
    });
}

// --- Render Video UI ---
function renderVideoUI() {
    if (!videoPreviewCard || !videoBadge) return;
    const customUrl = videoUrlInput ? videoUrlInput.value.trim() : '';

    if (newVideoFile) {
        videoPreviewCard.classList.remove('hidden');
        videoPlayer.src = URL.createObjectURL(newVideoFile);
        videoPlayer.classList.remove('hidden');
        videoPlaceholder.classList.add('hidden');
        videoFilename.textContent = newVideoFile.name;
        videoSubtext.textContent = `New MP4 Upload (${(newVideoFile.size / (1024 * 1024)).toFixed(1)} MB)`;
        videoBadge.textContent = '1 Video Selected';
        videoBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else if (customUrl && !removeVideoFlag) {
        videoPreviewCard.classList.remove('hidden');
        videoPlayer.classList.add('hidden');
        videoPlaceholder.classList.remove('hidden');
        videoFilename.textContent = customUrl;
        videoSubtext.textContent = 'Video Link / Cloudinary URL';
        videoBadge.textContent = 'URL Linked';
        videoBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300';
    } else if (existingVideoUrl && !removeVideoFlag) {
        videoPreviewCard.classList.remove('hidden');
        if (existingVideoUrl.endsWith('.mp4') || existingVideoUrl.includes('/video/upload/')) {
            videoPlayer.src = existingVideoUrl;
            videoPlayer.classList.remove('hidden');
            videoPlaceholder.classList.add('hidden');
        } else {
            videoPlayer.classList.add('hidden');
            videoPlaceholder.classList.remove('hidden');
        }
        videoFilename.textContent = existingVideoUrl;
        videoSubtext.textContent = 'Current Product Video';
        videoBadge.textContent = '1 Video Attached';
        videoBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800';
    } else {
        videoPreviewCard.classList.add('hidden');
        videoBadge.textContent = removeVideoFlag ? 'Video Removed' : 'No Video';
        videoBadge.className = 'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200';
    }
}

if (videoFileInput) {
    videoFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            newVideoFile = e.target.files[0];
            removeVideoFlag = false;
            renderVideoUI();
        }
    });
}

if (videoUrlInput) {
    videoUrlInput.addEventListener('input', () => {
        if (videoUrlInput.value.trim()) {
            removeVideoFlag = false;
        }
        renderVideoUI();
    });
}

if (removeVideoBtn) {
    removeVideoBtn.addEventListener('click', () => {
        newVideoFile = null;
        if (videoFileInput) videoFileInput.value = '';
        if (videoUrlInput) videoUrlInput.value = '';
        existingVideoUrl = '';
        removeVideoFlag = true;
        renderVideoUI();
    });
}

// --- FAQs Management ---
function createFaqRow(question = '', answer = '') {
    const row = document.createElement('div');
    row.className = 'faq-row p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 relative group';
    row.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider font-mono">FAQ Question &amp; Answer</span>
            <button type="button" class="remove-faq-btn text-rose-500 hover:text-rose-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer">
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

// --- Load Product on Mount ---
async function loadProduct() {
    try {
        const response = await fetch(`${BASE_URL}/api/product/${productId}`);
        const product = await response.json();
        if (!response.ok) throw new Error(product.error || 'Product load failed');
        
        document.getElementById('product-name').textContent = product.name || 'Product Details';
        form.description.value = product.description || '';
        form.rating.value = product.rating ?? 4.5;

        // Main Image
        originalMainImage = product.imagepath || '';
        renderMainImageUI();

        // Gallery Images
        existingGallery = Array.isArray(product.galleryImages) ? [...product.galleryImages] : [];
        newGalleryFiles = [];
        renderGalleryUI();

        // Product Video
        existingVideoUrl = product.videoUrl || '';
        if (form.videoUrl) form.videoUrl.value = existingVideoUrl;
        renderVideoUI();

        // Measurements / Volumes
        document.getElementById('volumes').innerHTML = (product.variants || []).map((variant, index) => 
            `<input aria-label="Measurement ${index + 1}" value="${escapeHtml(String(variant.volume))}" required class="seo-volume w-full rounded-lg border border-gray-300 p-3 text-sm">`
        ).join('');

        // FAQs
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

// --- Form Submit Handler ---
form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); 
    button.disabled = true; 
    button.textContent = 'Saving Product Changes...';

    const data = new FormData();
    data.append('description', form.description.value.trim());
    data.append('rating', String(form.rating.value));
    data.append('volumes', JSON.stringify([...document.querySelectorAll('.seo-volume')].map(input => input.value.trim())));
    data.append('faqs', JSON.stringify(getCollectedProductFaqs()));

    // Main Image handling
    if (mainImgInput && mainImgInput.files && mainImgInput.files[0]) {
        data.append('imagepath', mainImgInput.files[0]);
    }

    // Gallery Images handling
    data.append('existingGallery', JSON.stringify(existingGallery));
    newGalleryFiles.forEach((file) => {
        data.append('galleryImages', file);
    });

    // Video handling
    if (newVideoFile) {
        data.append('productVideo', newVideoFile);
    } else if (removeVideoFlag) {
        data.append('removeVideo', 'true');
    } else if (videoUrlInput && videoUrlInput.value.trim()) {
        data.append('videoUrl', videoUrlInput.value.trim());
    }

    try {
        const response = await fetch(`${BASE_URL}/api/product/seo-update/${productId}`, { 
            method: 'PUT', 
            headers: getAuthUploadHeaders(), 
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