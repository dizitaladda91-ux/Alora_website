import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Blog from "../models/blog.models.js";
import SimpleProduct from "../models/product.models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // 1. Static Pages
    staticPages.forEach(page => {
        const fullUrl = `${baseUrl}${page}`;
        if (!addedUrls.has(fullUrl)) {
            addedUrls.add(fullUrl);
            xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page === '' || page === '/products' ? 'daily' : 'monthly'}</changefreq>\n    <priority>${page === '' ? '1.0' : page === '/products' ? '0.9' : '0.7'}</priority>\n  </url>\n`;
        }
    });

    // 2. Products
    try {
        const products = await SimpleProduct.find(
            { $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }] },
            'slug name updatedAt'
        ).lean();
        products.forEach(prod => {
            const rawSlug = prod.slug || String(prod.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const slug = String(rawSlug).trim();
            if (slug) {
                const fullUrl = `${baseUrl}/product/${encodeURIComponent(slug)}`;
                if (!addedUrls.has(fullUrl)) {
                    addedUrls.add(fullUrl);
                    const modDate = prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : today;
                    xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${modDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
                }
            }
        });
    } catch (e) {
        console.warn("Sitemap generator product fetch warning:", e.message);
    }

    // 3. Blog Articles (All published articles & articles where status is not explicitly 'draft')
    try {
        const posts = await Blog.find(
            { $or: [{ status: 'published' }, { status: { $exists: false } }, { status: null }, { status: { $ne: 'draft' } }] },
            'slug title updatedAt createdAt status'
        ).lean();
        posts.forEach(p => {
            const rawSlug = p.slug || String(p.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const slug = String(rawSlug).trim();
            if (slug) {
                const fullUrl = `${baseUrl}/blog/${encodeURIComponent(slug)}`;
                if (!addedUrls.has(fullUrl)) {
                    addedUrls.add(fullUrl);
                    const modDate = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : today);
                    xml += `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${modDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
                }
            }
        });
    } catch (e) {
        console.warn("Sitemap generator blog fetch warning:", e.message);
    }

    xml += `</urlset>\n`;
    return xml;
}

export async function syncStaticSitemapFile() {
    try {
        const xml = await generateSitemapXml();
        const targets = [
            path.join(__dirname, '../../frontend/sitemap.xml'),
            path.join(__dirname, '../../public_html/sitemap.xml'),
            path.join(__dirname, '../../public/sitemap.xml'),
            path.join(__dirname, '../public/sitemap.xml')
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
