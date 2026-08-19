import BASE_URL, { getAuthHeaders } from './config.js'; // Make sure config.js provides your API domain URL

// 1. Initialize Quill Editor
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
    placeholder: 'Write your beautiful blog post here...',
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

// 2. Auto-generate Slug from Title
const titleInput = document.getElementById('title');
const slugInput = document.getElementById('slug');
let isSlugManuallyEdited = false; // Flag to check manual edits

// User manual slug badle toh auto-update stop kar do
slugInput.addEventListener('input', () => {
    if (slugInput.value.trim() !== '') {
        isSlugManuallyEdited = true;
    } else {
        isSlugManuallyEdited = false; // Empty karne par dubara auto-sync on
    }
});

// Title change par auto slug generator
titleInput.addEventListener('input', () => {
    if (!isSlugManuallyEdited) {
        const slugValue = titleInput.value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9 -]/g, '')  // Special chars remove
            .replace(/\s+/g, '-')         // Spaces -> hyphens
            .replace(/-+/g, '-');         // Multiple hyphens -> single hyphen

        slugInput.value = slugValue;
    }
});

// 3. Event Listener for Live Image Preview
const coverUpload = document.getElementById('cover-upload');
const coverPreview = document.getElementById('cover-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');

coverUpload.addEventListener('change', function(event) {
    const input = event.target;
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            coverPreview.src = e.target.result;
            coverPreview.classList.remove('hidden');       // Preview image dikhao
            uploadPlaceholder.classList.add('hidden');    // Icon/text chupaao
        }
        
        reader.readAsDataURL(input.files[0]);
    }
});

// 4. Handle Form Submit and API Request
const blogForm = document.getElementById('blog-form');
const submitBtn = document.getElementById('submit-btn');

blogForm.addEventListener('submit', async function(event) {
    event.preventDefault(); // Default submission reload rokne ke liye

    // Input values collect karna
    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();
    const metaTitle = document.getElementById('metaTitle').value.trim();
    const keywords = document.getElementById('keywords').value.trim();
    const category = document.getElementById('category').value.trim();
    const metaDesc = document.getElementById('metaDesc').value.trim();
    const schema = document.getElementById('schema').value.trim();
    const publisher = document.getElementById('publisher').value.trim();
    const coverUrl = document.getElementById('cover-url').value.trim();
    
    // Quill Rich text editor se direct HTML string nikalna
    const content = quill.root.innerHTML; 
    const coverFile = coverUpload.files[0];

    // Form validation checks
    if (!title || !slug || quill.getText().trim().length === 0) {
        alert("Bro! Title, Slug, and Blog Content are mandatory fields");
        return;
    }

    // Schema JSON Validator
    if (schema) {
        try {
            JSON.parse(schema);
        } catch (e) {
            alert("⚠️ The Schema (JSON-LD) format is invalid! Please enter valid JSON.");
            return;
        }
    }

    // Backend payload design using FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('slug', slug);
    formData.append('content', content);
    formData.append('metaTitle', metaTitle);
    formData.append('keywords', keywords);
    formData.append('category', category);
    formData.append('metaDesc', metaDesc);
    formData.append('schema', schema);
    formData.append('publisher', publisher);

    // Check if Base64 images are pasted directly into Quill editor
    if (content.includes('data:image/') && content.length > 1024 * 1024) {
        alert("⚠️ Warning: You have pasted large raw image(s) directly into the text editor. Pasted images increase post size beyond server limits.\n\nPlease upload images to Cloudinary / an image host or use the Image URL tool instead.");
        return;
    }

    // Cover image size check (Max 3.5 MB for Vercel 4.5MB payload limit)
    if (coverFile && coverFile.size > 3.5 * 1024 * 1024) {
        alert(`⚠️ Cover image file size is too large (${(coverFile.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 3.5 MB. Please select a smaller or compressed image.`);
        return;
    }

    // Agar image select kari hai toh file bhejo, warna URL fallback karo
    if (coverFile) {
        formData.append('coverImage', coverFile);
    } else if (coverUrl) {
        formData.append('coverImageUrl', coverUrl);
    }

    try {
        // UI handling: Button processing state
        submitBtn.innerText = "Publishing...";
        submitBtn.disabled = true;

        // Fetch command mapping to your backend server architecture
        const response = await fetch(`${BASE_URL}/api/blogs/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData 
        });

        const responseText = await response.text();
        let data = {};
        try {
            data = JSON.parse(responseText);
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

        if (response.ok && data.success !== false) {
            alert("🎉 Awesome! Your blog has been successfully published.");
            window.location.href = "./seoallpost.html";
        } else {
            alert(`Error: ${data.message || data.error || 'Something went wrong while saving the post.'}`);
        }

    } catch (error) {
        console.error("API Integration Failure:", error);
        alert(`⚠️ Upload / Network Notice: ${error.message || 'Connection interrupted'}.\n\nPlease ensure:\n1. Cover image size is under 3.5 MB.\n2. No raw heavy images are pasted directly in text editor.\n3. Admin session is logged in.`);
    } finally {
        // Resetting default button state
        submitBtn.innerText = "Publish Post";
        submitBtn.disabled = false;
    }
});
