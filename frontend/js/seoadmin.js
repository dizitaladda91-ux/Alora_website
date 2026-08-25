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

// Table & HTML Code View Support
const btnInsertTable = document.getElementById('btnInsertTable');
const btnToggleCodeView = document.getElementById('btnToggleCodeView');
const rawHtmlEditor = document.getElementById('raw-html-editor');
const editorContainer = document.getElementById('editor-container');
let isCodeView = false;

if (btnToggleCodeView && rawHtmlEditor) {
    btnToggleCodeView.addEventListener('click', () => {
        isCodeView = !isCodeView;
        if (isCodeView) {
            rawHtmlEditor.value = quill.root.innerHTML;
            editorContainer.parentElement.querySelector('.ql-toolbar')?.classList.add('hidden');
            editorContainer.classList.add('hidden');
            rawHtmlEditor.classList.remove('hidden');
            btnToggleCodeView.innerHTML = '<i class="fa-solid fa-eye text-emerald-400"></i> Visual Editor Mode';
            btnToggleCodeView.className = 'px-3 py-1.5 rounded-xl bg-slate-900 text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 border border-emerald-500/40 shadow-md';
        } else {
            quill.clipboard.dangerouslyPasteHTML(rawHtmlEditor.value);
            rawHtmlEditor.classList.add('hidden');
            editorContainer.classList.remove('hidden');
            editorContainer.parentElement.querySelector('.ql-toolbar')?.classList.remove('hidden');
            btnToggleCodeView.innerHTML = '<i class="fa-solid fa-code text-slate-600"></i> HTML Code Mode';
            btnToggleCodeView.className = 'px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 shadow-xs';
        }
    });
}

if (btnInsertTable) {
    btnInsertTable.addEventListener('click', () => {
        const colCount = parseInt(prompt("Enter number of table columns:", "3") || "0", 10);
        const rowCount = parseInt(prompt("Enter number of table rows (excluding header):", "3") || "0", 10);
        if (!colCount || !rowCount || colCount < 1 || rowCount < 1) return;

        let tableHtml = '<table class="w-full my-6 border-collapse rounded-xl overflow-hidden shadow-sm border border-slate-200">\n<thead>\n<tr class="bg-slate-900 text-white">\n';
        for (let c = 1; c <= colCount; c += 1) {
            tableHtml += `  <th class="p-3 text-left border border-slate-700 font-bold">Header ${c}</th>\n`;
        }
        tableHtml += '</tr>\n</thead>\n<tbody>\n';
        for (let r = 1; r <= rowCount; r += 1) {
            tableHtml += '<tr>\n';
            for (let c = 1; c <= colCount; c += 1) {
                tableHtml += `  <td class="p-3 border border-slate-200 text-slate-700">Row ${r} Cell ${c}</td>\n`;
            }
            tableHtml += '</tr>\n';
        }
        tableHtml += '</tbody>\n</table>\n<p><br></p>';

        if (isCodeView && rawHtmlEditor) {
            rawHtmlEditor.value += `\n${tableHtml}`;
        } else {
            const range = quill.getSelection(true) || { index: quill.getLength() };
            quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
        }
    });
}

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
                    console.log(`Image compressed from ${(file.size / (1024 * 1024)).toFixed(2)} MB to ${(compressedFile.size / 1024).toFixed(0)} KB`);
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
    if (isCodeView && rawHtmlEditor) {
        quillInstance.clipboard.dangerouslyPasteHTML(rawHtmlEditor.value);
    }
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
    
    // Form validation checks
    if (!title || !slug || quill.getText().trim().length === 0) {
        alert("Bro! Title, Slug, and Blog Content are mandatory fields");
        return;
    }

    // Auto-compress & upload any base64 images inside Quill content before sending to server
    submitBtn.innerText = "Processing & Uploading Images...";
    submitBtn.disabled = true;

    const content = await sanitizeAndUploadQuillImages(quill);
    const coverFile = coverUpload.files[0];

    // Form validation checks
    if (!title || !slug || quill.getText().trim().length === 0) {
        alert("Bro! Title, Slug, and Blog Content are mandatory fields");
        return;
    }

function parseMultipleSchemas(rawInput) {
    if (!rawInput || !String(rawInput).trim()) return [];
    let cleaned = String(rawInput).trim();

    if (cleaned.includes('<script')) {
        const scriptMatches = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches && scriptMatches.length > 0) {
            const extracted = [];
            for (const match of scriptMatches) {
                const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                if (content) {
                    const subSchemas = parseMultipleSchemas(content);
                    extracted.push(...subSchemas);
                }
            }
            if (extracted.length > 0) return extracted;
        } else {
            cleaned = cleaned.replace(/<[^>]*>/g, '').trim();
        }
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed.filter(item => item && typeof item === 'object');
        if (parsed && typeof parsed === 'object') return [parsed];
    } catch (e) {}

    const schemas = [];
    let depth = 0, startIndex = -1, inString = false, isEscaped = false;

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (isEscaped) { isEscaped = false; continue; }
        if (char === '\\') { isEscaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') {
                if (depth === 0) startIndex = i;
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0 && startIndex !== -1) {
                    const jsonCandidate = cleaned.substring(startIndex, i + 1);
                    try {
                        const parsedObj = JSON.parse(jsonCandidate);
                        if (parsedObj && typeof parsedObj === 'object') schemas.push(parsedObj);
                    } catch (e) {}
                    startIndex = -1;
                }
            }
        }
    }
    return schemas;
}

    // Schema JSON Validator (Supports Single, Array, @graph, or Multiple <script> Schemas)
    if (schema) {
        const parsed = parseMultipleSchemas(schema);
        if (parsed.length === 0) {
            alert("⚠️ The Schema (JSON-LD) format is invalid! Please enter valid JSON object(s) or script tags.");
            return;
        }
    }

    // Check if Base64 images are pasted directly into Quill editor
    if (content.includes('data:image/') && content.length > 1024 * 1024) {
        alert("⚠️ Warning: You have pasted large raw image(s) directly into the text editor. Pasted images increase post size beyond server limits.\n\nPlease upload images using the Toolbar Image Button 🖼️.");
        return;
    }

    try {
        // UI handling: Button processing state
        submitBtn.innerText = "Publishing...";
        submitBtn.disabled = true;

        // Auto-compress cover image if present
        let finalCoverFile = coverFile;
        if (coverFile) {
            submitBtn.innerText = "Optimizing Cover Image...";
            finalCoverFile = await compressImageFile(coverFile);
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

        if (finalCoverFile) {
            formData.append('coverImage', finalCoverFile);
        } else if (coverUrl) {
            formData.append('coverImageUrl', coverUrl);
        }

        submitBtn.innerText = "Publishing Post...";

        // Fetch command mapping to your backend server architecture
        const response = await fetch(`${BASE_URL}/api/blogs/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: formData 
        });

        const responseText = await response.text();
        let data = {};
        if (responseText) {
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = { message: responseText.slice(0, 200) };
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

        if (response.ok && data.success !== false) {
            alert("🎉 Awesome! Your blog has been successfully published.");
            window.location.href = "./seoallpost.html";
        } else {
            alert(`Error: ${data.message || data.error || 'Something went wrong while saving the post.'}`);
        }

    } catch (error) {
        console.error("API Integration Failure:", error);
        alert(`⚠️ Upload / Network Notice: ${error.message || 'Connection interrupted'}.\n\nPlease ensure:\n1. Cover image size is under 3.5 MB.\n2. Admin session is logged in.`);
    } finally {
        // Resetting default button state
        submitBtn.innerText = "Publish Post";
        submitBtn.disabled = false;
    }
});
