import BASE_URL from './config.js';

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
            body: formData
        });

        const resData = await response.json();

        if (response.ok || resData.success) {
            alert("🎉 Post successfully update !");
            window.location.href = "./seoallpost.html";
        } else {
            alert(`Error: ${resData.message || 'Update failed'}`);
        }

    } catch (error) {
        console.error("Update Error:", error);
        alert("Server network error!");
    } finally {
        submitBtn.innerText = "Update Post";
        submitBtn.disabled = false;
    }
});