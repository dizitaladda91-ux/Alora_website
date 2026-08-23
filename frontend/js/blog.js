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
            const fallbackBlogCollectionSchema = {
                "@context": "https://schema.org",
                "@type": "Blog",
                "name": "Alora Radiance Skincare Blogs",
                "description": "Explore dermatologist-tested skincare tips, guides, and natural beauty insights from Alora Radiance.",
                "url": window.location.href,
                "blogPost": (result.data || []).map(post => ({
                    "@type": "BlogPosting",
                    "headline": post.title,
                    "url": `${window.location.origin}/post/${post.slug || post._id}`,
                    "datePublished": post.createdAt
                }))
            };

            injectMultipleSchemasToDOM(latestPost ? latestPost.schema : null, fallbackBlogCollectionSchema);
            }

            // Helper to strip HTML tags for clean description snippet
            const getSnippet = (post) => {
                if (post.metaDesc && post.metaDesc.trim()) return post.metaDesc.trim();
                if (!post.content) return "Explore dermatologist-tested skincare tips and natural beauty insights from Alora Radiance.";
                const cleanText = post.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                return cleanText.length > 140 ? cleanText.slice(0, 140) + '...' : cleanText;
            };

            // Cards loop rendering as specified in design mock
            result.data.forEach(post => {
                const formattedDate = new Date(post.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });

                const absoluteCoverImage = post.coverImage 
                    ? (post.coverImage.startsWith('http') ? post.coverImage : `${BASE_URL}${post.coverImage}`)
                    : './static/alora5.webp';

                const publisherName = post.publisher || 'Alora Radiance';
                const snippetText = getSnippet(post);
                const categoryName = post.category || 'Skincare';

                const cardHTML = `
                    <div class="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group relative cursor-pointer" onclick="goToPost('${post.slug}')">
                        
                        <!-- Top Image Area with Overlay Category Pill (Aspect Ratio Preserved to Avoid Text Cropping) -->
                        <div class="relative w-full aspect-[16/9.5] sm:aspect-[16/9] rounded-2xl overflow-hidden mb-4 bg-slate-100 flex items-center justify-center">
                            <img src="${absoluteCoverImage}" alt="${post.title}" class="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105">
                            
                            <!-- Category Badge Pill on Top-Left of Image -->
                            <div class="absolute top-3 left-3 z-10">
                                <span class="bg-white/95 text-slate-900 border border-[#800000] text-[11px] font-bold px-3 py-1 rounded-full shadow-sm tracking-wide">
                                    ${categoryName}
                                </span>
                            </div>
                        </div>

                        <!-- Card Content Section -->
                        <div class="flex-1 flex flex-col justify-between space-y-3">
                            <div>
                                <!-- Rich Maroon Title -->
                                <h3 class="text-lg sm:text-xl font-bold font-sans leading-snug text-[#800000] group-hover:text-[#8B0000] transition-colors duration-200 line-clamp-2 mb-2">
                                    ${post.title}
                                </h3>

                                <!-- Description Snippet -->
                                <p class="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed line-clamp-3">
                                    ${snippetText}
                                </p>
                            </div>

                            <!-- Footer Bar: Publisher | Date & Read More Button -->
                            <div class="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                                <span class="text-xs font-bold text-[#800000] tracking-wide">
                                    ${publisherName} | ${formattedDate}
                                </span>

                                <span class="bg-black hover:bg-slate-900 text-white text-xs font-extrabold px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-sm group-hover:scale-105">
                                    Read More <i class="fa-solid fa-angle-right text-[10px]"></i>
                                </span>
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