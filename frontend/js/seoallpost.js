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
                    <td colspan="4" class="px-6 py-10 text-center text-gray-500">
                        <i class="fa-solid fa-folder-open text-2xl block mb-2 text-gray-400"></i> Koi blog nahi mila! Create New Post par click karein.
                    </td>
                </tr>`;
            return;
        }

        renderBlogTable(blogs);

    } catch (error) {
        console.error("Fetch error:", error);
        blogTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-10 text-center text-red-500 font-medium">
                    <i class="fa-solid fa-circle-exclamation mr-2"></i> Backend se blogs load nahi ho paaye.
                </td>
            </tr>`;
    }
}

function renderBlogTable(blogs) {
    blogTableBody.innerHTML = '';

    blogs.forEach(blog => {
        const imageSrc = blog.coverImage 
            ? (blog.coverImage.startsWith('http') ? blog.coverImage : `${BASE_URL}${blog.coverImage}`) 
            : 'https://placehold.co/600x400?text=No+Image';

        const blogId = blog._id || blog.id;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50/70 transition";
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <img src="${imageSrc}" class="w-16 h-10 object-cover rounded border border-gray-200 shadow-sm" alt="cover">
            </td>
            <td class="px-6 py-4">
                <div class="font-semibold text-gray-900 line-clamp-1">${blog.title}</div>
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    ${blog.category || 'Uncategorized'}
                </span>
            </td>
            <td class="px-6 py-4 text-gray-500 font-mono text-xs">
                /blog/${blog.slug}
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap space-x-2">
                <button data-id="${blogId}" class="edit-btn inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button data-id="${blogId}" class="delete-btn inline-flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </td>
        `;
        blogTableBody.appendChild(tr);
    });

    attachActionListeners();
}

function attachActionListeners() {
    // Edit Action Trigger
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const blogId = btn.getAttribute('data-id');
            // seoadmin.html pe URL parameter pass karenge
            window.location.href = `./seoadminupdate.html?id=${blogId}`;
        });
    });

    // Delete Action Trigger
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const blogId = btn.getAttribute('data-id');
            if (confirm("Kya aap pakka is blog ko delete karna chahte hain?")) {
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
                        alert("🗑️ Blog successfully delete ");
                        fetchAllBlogs();
                    } else {
                        alert(`Error: ${resData.message || 'Some error to Delete'}`);
                        btn.innerText = "Delete";
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error("Delete failure:", error);
                    alert("Server error! Delete fail .");
                    btn.innerText = "Delete";
                    btn.disabled = false;
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', fetchAllBlogs);
