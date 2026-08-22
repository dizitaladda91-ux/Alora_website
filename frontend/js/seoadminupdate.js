import BASE_URL, { getAuthHeaders } from './config.js';

// 1. Quill Editor Setup
const quill = new Quill('#editor-container', {
    modules: {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],        
            [{ 'color': [] }, { 'background': [] }],          
            [{ 'align': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['blockquote', 'link', 'image'],                  
            ['clean']                                         
        ]
    },
    placeholder: 'Write your content here...',
    theme: 'snow'
});

// Client-side Image Compressor Helper
function compressImageFile(file, maxWidth = 1920, quality = 0.82) {
    return new Promise((resolve) => {
        if (!file || file.size <= 800 * 1024) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) return resolve(file);
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}

// Helper: Convert Base64 data URI to File object
function dataURItoFile(dataURI, filename = 'pasted-image.jpg') {
    try {
        const arr = dataURI.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    } catch (e) {
        return null;
    }
}

// Auto-upload and replace any base64 images inside Quill HTML before form submission
async function sanitizeAndUploadQuillImages(quillInstance) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = quillInstance.root.innerHTML;
    const base64Imgs = tempDiv.querySelectorAll('img[src^="data:image/"]');
    
    if (base64Imgs.length === 0) return quillInstance.root.innerHTML;

    console.log(`Found ${base64Imgs.length} base64 images in content. Uploading to Cloudinary...`);

    for (const img of base64Imgs) {
        const dataSrc = img.getAttribute('src');
        const file = dataURItoFile(dataSrc);
        if (file) {
            try {
                const compressed = await compressImageFile(file);
                const formData = new FormData();
                formData.append('image', compressed);

                const response = await fetch(`${BASE_URL}/api/blogs/upload-image`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    credentials: 'include',
                    body: formData
                });

                const data = await response.json();
                if (response.ok && data.success && (data.url || data.imageUrl)) {
                    img.setAttribute('src', data.url || data.imageUrl);
                }
            } catch (err) {
                console.error("Failed to upload inline base64 image:", err);
            }
        }
    }

    quillInstance.root.innerHTML = tempDiv.innerHTML;
    return tempDiv.innerHTML;
}

// Custom Cloudinary Image Uploader for Quill Editor
async function uploadImageFile(file) {
    if (!file) return;

    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertText(range.index, '⏳ Uploading image...', 'user');

    try {
        const compressedFile = await compressImageFile(file);
        const formData = new FormData();
        formData.append('image', compressedFile);

        const response = await fetch(`${BASE_URL}/api/blogs/upload-image`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData
        });

        const responseText = await response.text();
        let data = {};
        if (responseText) {
            try { data = JSON.parse(responseText); } catch (e) { data = { message: responseText.slice(0, 150) }; }
        }

        quill.deleteText(range.index, '⏳ Uploading image...'.length);

        if (response.ok && data.success && (data.url || data.imageUrl)) {
            const imageUrl = data.url || data.imageUrl;
            quill.insertEmbed(range.index, 'image', imageUrl);
            quill.setSelection(range.index + 1);
        } else {
            alert(`⚠️ Image upload failed: ${data.message || 'Could not upload image.'}`);
        }
    } catch (err) {
        console.error("Inline image upload error:", err);
        quill.deleteText(range.index, '⏳ Uploading image...'.length);
        alert("⚠️ Image upload failed. Please check your internet connection.");
    }
}

// Bind custom image toolbar button
quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
        if (input.files && input.files[0]) {
            uploadImageFile(input.files[0]);
        }
    };
});

// Auto-upload pasted images & screenshots
quill.root.addEventListener('paste', async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items || [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                e.preventDefault();
                await uploadImageFile(file);
                return;
            }
        }
    }

    const pastedHtml = clipboardData.getData('text/html');
    if (pastedHtml && pastedHtml.includes('data:image/')) {
        setTimeout(async () => {
            await sanitizeAndUploadQuillImages(quill);
        }, 100);
    }
});

// Intercept drag-and-drop images
quill.root.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            e.preventDefault();
            uploadImageFile(file);
        }
    }
});

// DOM Elements
const titleInput = document.getElementById('title');
const slugInput = document.getElementById('slug');
const metaTitleInput = document.getElementById('metaTitle');
const keywordsInput = document.getElementById('keywords');
const categoryInput = document.getElementById('category');
const metaDescInput = document.getElementById('metaDesc');
const schemaInput = document.getElementById('schema');
const publisherInput = document.getElementById('publisher');
const coverUrlInput = document.getElementById('cover-url');
const coverUpload = document.getElementById('cover-upload');
const coverPreview = document.getElementById('cover-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const updateForm = document.getElementById('update-blog-form');
const submitBtn = document.getElementById('submit-btn');

// Extract ID from URL (?id=...)
const urlParams = new URLSearchParams(window.location.search);
const blogId = urlParams.get('id');

// 2. Load Existing Data On Page Load
document.addEventListener('DOMContentLoaded', async () => {
    if (!blogId) {
        alert("⚠️ Invalid Request: No Blog ID found!");
        window.location.href = "./seoallpost.html";
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/blogs/post/${blogId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            alert("Error: Failed to fetch post details.");
            return;
        }

        const blog = data.blog || data.data;

        // Auto-fill Input Fields
        titleInput.value = blog.title || '';
        slugInput.value = blog.slug || '';
        metaTitleInput.value = blog.metaTitle || '';
        keywordsInput.value = blog.keywords || '';
        categoryInput.value = blog.category || '';
        metaDescInput.value = blog.metaDesc || '';
        schemaInput.value = typeof blog.schema === 'object' ? JSON.stringify(blog.schema) : (blog.schema || '');
        publisherInput.value = blog.publisher || '';

        // Auto-fill Quill Editor Content
        if (blog.content) {
            quill.clipboard.dangerouslyPasteHTML(blog.content);
        }

        // Show Cover Image Preview
        if (blog.coverImage) {
            const imageSrc = blog.coverImage.startsWith('http') 
                ? blog.coverImage 
                : `${BASE_URL}${blog.coverImage}`;
            coverPreview.src = imageSrc;
            coverPreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        }

    } catch (error) {
        console.error("Fetch Data Error:", error);
        alert("Server error: Failed to load blog details.");
    }
});

// Image Upload Preview Listener
coverUpload.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            coverPreview.src = evt.target.result;
            coverPreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

// 3. Submit Updated Form (PUT Request)
updateForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();
    const content = quill.root.innerHTML;

    if (!title || !slug || quill.getText().trim().length === 0) {
        alert("Title, Slug and Content required !");
        return;
    }

    const schemaVal = schemaInput.value.trim();
    if (schemaVal) {
        const parsed = (typeof window.parseMultipleSchemas === 'function') 
            ? window.parseMultipleSchemas(schemaVal) 
            : [];
            
        if (parsed.length === 0) {
            try {
                JSON.parse(schemaVal);
            } catch (e) {
                alert("⚠️ The Schema (JSON-LD) format is invalid! Please enter valid JSON object(s) or script tags.");
                return;
            }
        }
    }

    try {
        submitBtn.innerText = "Processing & Uploading Images...";
        submitBtn.disabled = true;

        const content = await sanitizeAndUploadQuillImages(quill);

        let finalCoverFile = coverUpload.files[0];
        if (coverUpload.files[0]) {
            submitBtn.innerText = "Optimizing Cover Image...";
            finalCoverFile = await compressImageFile(coverUpload.files[0]);
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('slug', slug);
        formData.append('content', content);
        formData.append('metaTitle', metaTitleInput.value.trim());
        formData.append('keywords', keywordsInput.value.trim());
        formData.append('category', categoryInput.value.trim());
        formData.append('metaDesc', metaDescInput.value.trim());
        formData.append('schema', schemaInput.value.trim());
        formData.append('publisher', publisherInput.value.trim());

        if (finalCoverFile) {
            formData.append('coverImage', finalCoverFile);
        } else if (coverUrlInput.value.trim()) {
            formData.append('coverUrl', coverUrlInput.value.trim());
        }

        submitBtn.innerText = "Updating Post...";

        const response = await fetch(`${BASE_URL}/api/blogs/update/${blogId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData
        });

        const responseText = await response.text();
        let resData = {};
        if (responseText) {
            try {
                resData = JSON.parse(responseText);
            } catch (err) {
                resData = { message: responseText.slice(0, 200) };
            }
        }

        if (response.status === 401 || response.status === 403) {
            alert("⚠️ Session expired or unauthorized! Please log in to admin account and try again.");
            window.location.href = "./login.html";
            return;
        }

        if (response.status === 413) {
            alert("⚠️ Error 413: Cover image or blog content size is too large for the server. Please select a smaller cover image and try again.");
            return;
        }

        if (response.ok && resData.success !== false) {
            alert("🎉 Post successfully updated!");
            window.location.href = "./seoallpost.html";
        } else {
            alert(`Error: ${resData.message || resData.error || 'Update failed'}`);
        }

    } catch (error) {
        console.error("Update Error:", error);
        alert(`⚠️ Update / Network Notice: ${error.message || 'Connection interrupted'}.\n\nPlease ensure:\n1. Cover image size is under 3.5 MB.\n2. Admin session is logged in.`);
    } finally {
        submitBtn.innerText = "Update Post";
        submitBtn.disabled = false;
    }
});
