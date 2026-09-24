import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Blog from "../models/blog.models.js";
import SimpleProduct from "../models/product.models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baseline product slugs for guaranteed crawlability even during cold starts or transient DB reconnections
const BASELINE_PRODUCT_SLUGS = [
    'purifying-glow-face-wash',
    'brightening-hydrating-face-serum',
    'soothing-face-scrub',
    'face-cream-sunscreen-spf-30',
    'soothing-body-lotion',
    'daily-glow-duo',
    'cleanse-protect-duo',
    'hydration-duo',
    'radiance-ritual-trio',
    'alora-radiance-travel-essentials-kit'
];

// Baseline blog slugs for guaranteed crawlability even during cold starts or transient DB reconnections
const BASELINE_BLOG_SLUGS = [
    'how-to-treat-hyperpigmentation-and-dark-spots',
    'how-to-repair-damaged-skin-barrier-routine',
    'summer-skincare-routine-for-oily-combination-skin',
    'how-to-know-your-skin-type-oily-dry-sensitive',
    'how-to-build-a-skincare-routine-for-beginners-in-india',
    'benefits-of-saffron',
    'what-makes-a-face-cream-sunscreen-actually-work',
    'why-you-need-to-wear-a-face-cream-sunscreen',
    'how-often-should-you-exfoliate-a-soothing-scrub-guide',
    'top-face-scrub-ingredients',
    'best-face-wash',
    'top-facewash-ingredients',
    'face-serum',
    'face-serum-ingredients',
    'how-to-get-soft-smooth-skin-the-right-body-lotion',
    'body-lotion-ingredients'
];

export async function generateSitemapXml() {
    const baseUrl = 'https://aloraradiance.com';
    const staticPages = [
        '',
        '/products',
        '/about',
        '/blog',
        '/certificates',
        '/faq',
        '/privacy-policy',
        '/terms-and-conditions',
        '/return-refund',
        '/corporate-governance'
    ];

    const today = new Date().toISOString().split('T')[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const addedUrls = new Set();

    // 1. Core Static Brand & Store Pages
    staticPages.forEach(page => {
        const fullUrl = `${baseUrl}${page}`;
        if (!addedUrls.has(fullUrl)) {
            addedUrls.add(fullUrl);
            const freq = page === '' || page === '/products' ? 'daily' : page === '/blog' ? 'daily' : 'monthly';
            const priority = page === '' ? '1.0' : page === '/products' ? '0.9' : page === '/blog' ? '0.8' : '0.7';
            xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
        }
    });

    // 2. Products (from DB with fallback baseline)
    let productSlugsAdded = 0;
    try {
        const products = await SimpleProduct.find(
            { $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }, { isActive: true }, { isActive: { $exists: false } }] },
            'slug name updatedAt'
        ).lean();

        if (Array.isArray(products) && products.length > 0) {
            products.forEach(prod => {
                const rawSlug = prod.slug || String(prod.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                const slug = String(rawSlug).trim();
                if (slug) {
                    const fullUrl = `${baseUrl}/product/${encodeURIComponent(slug)}`;
                    if (!addedUrls.has(fullUrl)) {
                        addedUrls.add(fullUrl);
                        productSlugsAdded++;
                        const modDate = prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : today;
                        xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${modDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
                    }
                }
            });
        }
    } catch (e) {
        console.warn("Sitemap generator product fetch warning:", e.message);
    }

    // Ensure baseline products are present if DB query returned none
    if (productSlugsAdded === 0) {
        BASELINE_PRODUCT_SLUGS.forEach(slug => {
            const fullUrl = `${baseUrl}/product/${encodeURIComponent(slug)}`;
            if (!addedUrls.has(fullUrl)) {
                addedUrls.add(fullUrl);
                xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
            }
        });
    }

    // 3. Blog Articles (from DB with fallback baseline)
    let blogSlugsAdded = 0;
    try {
        const posts = await Blog.find(
            { $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }, { status: { $ne: 'draft' } }] },
            'slug title updatedAt createdAt status'
        ).lean();

        if (Array.isArray(posts) && posts.length > 0) {
            posts.forEach(p => {
                const rawSlug = p.slug || String(p.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                const slug = String(rawSlug).trim();
                if (slug) {
                    const fullUrl = `${baseUrl}/blog/${encodeURIComponent(slug)}`;
                    if (!addedUrls.has(fullUrl)) {
                        addedUrls.add(fullUrl);
                        blogSlugsAdded++;
                        const modDate = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : today);
                        xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${modDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                    }
                }
            });
        }
    } catch (e) {
        console.warn("Sitemap generator blog fetch warning:", e.message);
    }

    // Ensure baseline blogs are present if DB query returned none
    if (blogSlugsAdded === 0) {
        BASELINE_BLOG_SLUGS.forEach(slug => {
            const fullUrl = `${baseUrl}/blog/${encodeURIComponent(slug)}`;
            if (!addedUrls.has(fullUrl)) {
                addedUrls.add(fullUrl);
                xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
            }
        });
    }

    xml += `</urlset>\n`;
    return xml;
}

export async function syncStaticSitemapFile() {
    try {
        const xml = await generateSitemapXml();
        const targets = [
            path.join(__dirname, '../../frontend/sitemap.xml'),
            path.join(process.cwd(), 'frontend/sitemap.xml'),
            path.join(__dirname, '../../public_html/sitemap.xml'),
            path.join(__dirname, '../../public/sitemap.xml')
        ];

        for (const targetPath of targets) {
            const parentDir = path.dirname(targetPath);
            if (fs.existsSync(parentDir)) {
                await fs.promises.writeFile(targetPath, xml, 'utf8');
            }
        }
    } catch (err) {
        console.warn("Auto sync sitemap warning:", err.message);
    }
}
