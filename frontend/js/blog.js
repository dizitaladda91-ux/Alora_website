import BASE_URL from './config.js'; 

async function renderBlogCards() {
    const container = document.getElementById('blog-posts-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full text-center py-10 text-ash animate__animated animate__fadeIn">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2 text-clay"></i>
            <p class="text-sm">Loading amazing insights...</p>
        </div>
    `; 

    try {
        const response = await fetch(`${BASE_URL}/api/blogs/all`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            container.innerHTML = ""; // Clear loader

            // 🔴 OPTIONAL: Agar aap sabse latest blog ka schema/meta title pure blog list page par dikhana chahte hain:
            const latestPost = result.data[0]; 
            if (latestPost) {
                // Head Elements Update
                document.getElementById('dynamic-title').innerText = `Alora Radiance Blogs | Latest: ${latestPost.metaTitle || latestPost.title}`;
                document.getElementById('dynamic-meta-desc')?.setAttribute('content', latestPost.metaDesc || '');
                document.getElementById('dynamic-keywords')?.setAttribute('content', latestPost.keywords || '');

            // Schema Injection for Blog.html page (Detailed SEO Extension & Googlebot compatibility)
            let schemaScript = document.getElementById('dynamic-json-ld');
            if (!schemaScript) {
                schemaScript = document.createElement('script');
                schemaScript.id = 'dynamic-json-ld';
                schemaScript.type = 'application/ld+json';
                document.head.appendChild(schemaScript);
            }

            let schemaToInject = null;

            if (latestPost && latestPost.schema && String(latestPost.schema).trim()) {
                try {
                    const rawSchema = String(latestPost.schema).trim();
                    schemaToInject = (rawSchema.startsWith('{') || rawSchema.startsWith('[')) 
                        ? JSON.parse(rawSchema) 
                        : rawSchema;
                } catch (e) {
                    schemaToInject = latestPost.schema;
                }
            } else if (result.data.length > 0) {
                // Automatic fallback Blog Collection schema for Blog.html
                schemaToInject = {
                    "@context": "https://schema.org",
                    "@type": "Blog",
                    "name": "Alora Radiance Skincare Blogs",
                    "description": "Explore dermatologist-tested skincare tips, guides, and natural beauty insights from Alora Radiance.",
                    "url": window.location.href,
                    "blogPost": result.data.map(post => ({
                        "@type": "BlogPosting",
                        "headline": post.title,
                        "url": `${window.location.origin}/post/${post.slug || post._id}`,
                        "datePublished": post.createdAt
                    }))
                };
            }

            if (schemaToInject) {
                schemaScript.textContent = typeof schemaToInject === 'object' 
                    ? JSON.stringify(schemaToInject, null, 2) 
                    : schemaToInject;
            }
            }

            // Cards loop rendering as usual
            result.data.forEach(post => {
                const formattedDate = new Date(post.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                const absoluteCoverImage = post.coverImage.startsWith('http') 
                    ? post.coverImage 
                    : `${BASE_URL}${post.coverImage}`;

                const cardHTML = `
                    <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-amber-900/10 flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group" onclick="goToPost('${post.slug}')">
                        <div class="w-full h-52 overflow-hidden bg-slate-100 relative">
                            <img src="${absoluteCoverImage}" alt="${post.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                        </div>
                        
                        <div class="p-5 flex flex-col flex-grow justify-between space-y-4">
                            <div>
                                <div class="flex items-center space-x-2 mb-2.5 text-xs tracking-wide">
                                    <span class="bg-amber-100/70 text-[#8B4513] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-roboto border border-amber-300/40">${post.category || 'General'}</span>
                                    <span class="text-slate-300">•</span>
                                    <span class="text-slate-500 font-medium">${formattedDate}</span>
                                </div>
                                <h3 class="text-base sm:text-lg font-bold font-fraunces leading-snug text-slate-900 group-hover:text-[#8B4513] transition-colors duration-200 line-clamp-2">
                                    ${post.title}
                                </h3>
                            </div>
                            
                            <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span class="text-[#8B4513] text-xs font-bold inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-200">
                                    Read Article <i class="fa-solid fa-arrow-right text-[10px]"></i>
                                </span>
                                <span class="text-[11px] text-slate-400 font-medium">3 min read</span>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += cardHTML;
            });
            
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-12 text-ash animate__animated animate__fadeIn">
                    <p class="text-lg font-medium font-fraunces">No posts published yet.</p>
                    <p class="text-xs mt-1">Check back later for fresh learning modules.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Failed to load blogs from server:", err.message);
        container.innerHTML = `
            <div class="col-span-full text-center py-12 text-clay animate__animated animate__shakeX">
                <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
                <p class="font-bold">Failed to connect to the backend server</p>
                <p class="text-xs text-ash mt-1">Connection Refused at URL: ${BASE_URL}</p>
            </div>
        `;
    }
}

function goToPost(slug) {
    const cleanSlug = String(slug || '').trim();
    if (!cleanSlug) return;

    const targetPath = `/post/${encodeURIComponent(cleanSlug)}`;

    const host = window.location.hostname;
    const isLocalLiveHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

    let resolvedBase = BASE_URL;
    if (!resolvedBase && isLocalLiveHost) {
        resolvedBase = 'http://127.0.0.1:5000';
    }

    const targetUrl = resolvedBase
        ? `${resolvedBase}${targetPath}`
        : targetPath;

    window.location.href = targetUrl;
}

window.goToPost = goToPost;
document.addEventListener('DOMContentLoaded', renderBlogCards);