import BASE_URL, { getAuthHeaders } from './config.js';
const blogTableBody = document.getElementById('blog-table-body');
async function fetchAllBlogs() {
    try {
        const response = await fetch(`${BASE_URL}/api/blogs/all`);
        const data = await response.json();
        const blogs = data.blogs || data.data || data;
        if (!response.ok || !blogs || blogs.length === 0) {
            blogTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-12 text-center text-slate-400">
                        <i class="fa-solid fa-folder-open text-3xl block mb-2 text-slate-300"></i>
                        <p class="text-xs font-semibold">No blog posts found! Click 'Create New Article' to write your first post.</p>
                    </td>
                </tr>`;
            return;
        }
        renderBlogTable(blogs);
    } catch (error) {
        console.error("Fetch error:", error);
        blogTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-12 text-center text-rose-500 font-medium">
                    <i class="fa-solid fa-circle-exclamation mr-2"></i> Failed to connect to backend API. Please refresh.
                </td>
            </tr>`;
    }
}
function decodeEntities(str) {
    if (str === null || str === undefined) return '';
    let decoded = String(str);
    let previous;
    let iterations = 0;
    do {
        previous = decoded;
        decoded = decoded
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;|&#39;|&apos;/gi, "'");
        iterations++;
    } while (decoded !== previous && iterations < 5);
    return decoded;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const unescaped = decodeEntities(str);
    return String(unescaped)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderBlogTable(blogs) {
    blogTableBody.innerHTML = '';
    blogs.forEach(blog => {
        const imageSrc = blog.coverImage 
            ? (blog.coverImage.startsWith('http') ? blog.coverImage : `${BASE_URL}${blog.coverImage}`) 
            : './static/alora5.webp';
        const blogId = blog._id || blog.id;
        const safeTitle = escapeHtml(blog.title || 'Untitled');
        const safeCategory = escapeHtml(blog.category || 'Uncategorized');
        const tr = document.createElement('tr');
        tr.className = "hover:bg-amber-50/40 transition-colors duration-200";
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <img src="${imageSrc}" class="w-16 h-11 object-cover rounded-xl border border-slate-200 shadow-sm" alt="cover">
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-900 line-clamp-1 text-sm font-fraunces">${safeTitle}</div>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 mt-1 rounded-md text-[10px] font-extrabold bg-amber-100/80 text-[#8B4513] border border-amber-300/60 uppercase tracking-wider">
                    <i class="fa-solid fa-tag text-[9px]"></i> ${safeCategory}
                </span>
            </td>
            <td class="px-6 py-4 text-slate-500 font-mono text-xs">
                <span class="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">/post/${blog.slug}</span>
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap space-x-2">
                <button data-id="${blogId}" class="edit-btn inline-flex items-center gap-1.5 bg-amber-50 text-[#8B4513] hover:bg-[#8B4513] hover:text-white border border-amber-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button data-id="${blogId}" class="delete-btn inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </td>
        `;
        blogTableBody.appendChild(tr);
    });
    attachActionListeners();
}
function attachActionListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const blogId = btn.getAttribute('data-id');
            window.location.href = `./seoadminupdate.html?id=${blogId}`;
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const blogId = btn.getAttribute('data-id');
            if (confirm("Are you sure you want to delete this article?")) {
                try {
                    btn.innerText = "Deleting...";
                    btn.disabled = true;
                    const response = await fetch(`${BASE_URL}/api/blogs/delete/${blogId}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                        credentials: 'include'
                    });
                    const resData = await response.json();
                    if (response.ok || resData.success) {
                        alert("🗑️ Article successfully deleted.");
                        fetchAllBlogs();
                    } else {
                        alert(`Error: ${resData.message || 'Failed to delete article'}`);
                        btn.innerText = "Delete";
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error("Delete failure:", error);
                    alert("Server error during delete operation.");
                    btn.innerText = "Delete";
                    btn.disabled = false;
                }
            }
        });
    });
}
document.addEventListener('DOMContentLoaded', fetchAllBlogs);