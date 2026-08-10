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

                // Schema Injection (Purane script ko remove karke naya lagana taaki duplicate na ho)
                const oldSchema = document.getElementById('dynamic-json-ld');
                if (oldSchema) oldSchema.remove();

                if (latestPost.schema) {
                    const scriptTag = document.createElement('script');
                    scriptTag.id = 'dynamic-json-ld';
                    scriptTag.type = 'application/ld+json';
                    scriptTag.text = typeof latestPost.schema === 'string' ? latestPost.schema : JSON.stringify(latestPost.schema);
                    document.head.appendChild(scriptTag);
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
                    <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/80 flex flex-col cursor-pointer transition transform hover:-translate-y-1 duration-300" onclick="goToPost('${post.slug}')">
                        <div class="w-full aspect-[16/10] overflow-hidden bg-gray-100">
                            <img src="${absoluteCoverImage}" alt="${post.title}" class="w-full h-full object-cover">
                        </div>
                        
                        <div class="p-5 flex flex-col flex-grow justify-between">
                            <div>
                                <div class="flex items-center space-x-2 mb-2 text-xs tracking-wide">
                                    <span class="text-ash font-roboto">${formattedDate}</span>
                                    <span class="text-ash">•</span>
                                    <span class="bg-sage-light text-sage px-2 py-0.5 rounded text-[11px] font-medium uppercase font-roboto">${post.category}</span>
                                </div>
                                <h3 class="text-base font-bold font-fraunces leading-snug text-ink hover:text-clay transition duration-200 mb-4 line-clamp-2">
                                    ${post.title}
                                </h3>
                            </div>
                            
                            <div>
                                <span class="text-clay text-sm font-semibold inline-flex items-center gap-1 hover:underline">
                                    Continue reading <i class="fa-solid fa-arrow-right text-xs"></i>
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
    window.location.href = `./post.html?slug=${slug}`;
}

window.goToPost = goToPost;
document.addEventListener('DOMContentLoaded', renderBlogCards);