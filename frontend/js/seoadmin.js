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

        const data = await response.json();

        if (response.ok || data.success) {
            alert("🎉 Awesome! Your blog has been successfully published to the backend.");
            window.location.href = "./seoallpost.html";
        } else {
            alert(`Error: ${data.message || 'Something went wrong while saving the post.'}`);
        }

    } catch (error) {
        console.error("API Integration Failure:", error);
        alert("Server network disconnected or the backend has crashed. Please check again!");
    } finally {
        // Resetting default button state
        submitBtn.innerText = "Publish Post";
        submitBtn.disabled = false;
    }
});
