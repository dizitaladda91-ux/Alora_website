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

// Custom Cloudinary Image Uploader for Quill Editor
async function uploadImageFile(file) {
    if (!file) return;

    if (file.size > 3.5 * 1024 * 1024) {
        alert("⚠️ Image file is too large! Maximum allowed size for editor images is 3.5 MB.");
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    const range = quill.getSelection(true) || { index: quill.getLength() };
    quill.insertText(range.index, '⏳ Uploading image...', 'user');

    try {
        const response = await fetch(`${BASE_URL}/api/blogs/upload-image`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData
        });

        const data = await response.json();
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

// Auto-upload pasted images
quill.root.addEventListener('paste', (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData || !clipboardData.files || clipboardData.files.length === 0) return;

    const file = clipboardData.files[0];
    if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        uploadImageFile(file);
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

    // Check if Base64 images are pasted directly into Quill editor
    if (content.includes('data:image/') && content.length > 1024 * 1024) {
        alert("⚠️ Warning: You have pasted large raw image(s) directly into the text editor. Pasted images increase post size beyond server limits.\n\nPlease upload images to Cloudinary / an image host or use the Image URL tool instead.");
        return;
    }

    // Cover image size check (Max 3.5 MB for Vercel 4.5MB payload limit)
    if (coverUpload.files[0] && coverUpload.files[0].size > 3.5 * 1024 * 1024) {
        alert(`⚠️ Cover image file size is too large (${(coverUpload.files[0].size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 3.5 MB. Please select a smaller or compressed image.`);
        return;
    }

    if (coverUpload.files[0]) {
        formData.append('coverImage', coverUpload.files[0]);
    } else if (coverUrlInput.value.trim()) {
        formData.append('coverUrl', coverUrlInput.value.trim());
    }

    try {
        submitBtn.innerText = "Updating...";
        submitBtn.disabled = true;

        const response = await fetch(`${BASE_URL}/api/blogs/update/${blogId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData
        });

        const responseText = await response.text();
        let resData = {};
        try {
            resData = JSON.parse(responseText);
        } catch (e) {
            console.warn("Server response was not JSON:", responseText);
        }

        if (response.status === 401 || response.status === 403) {
            alert("⚠️ Session expired or unauthorized! Please log in to admin account and try again.");
            window.location.href = "./login.html";
            return;
        }

        if (response.status === 413) {
            alert("⚠️ Error 413: Cover image or blog content size is too large for the server. Please compress your image (under 3.5 MB) and try again.");
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
        alert(`⚠️ Update / Network Notice: ${error.message || 'Connection interrupted'}.\n\nPlease ensure:\n1. Cover image size is under 3.5 MB.\n2. No raw heavy images are pasted directly in text editor.\n3. Admin session is logged in.`);
    } finally {
        submitBtn.innerText = "Update Post";
        submitBtn.disabled = false;
    }
});
