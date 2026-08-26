import Blog from '../models/blog.models.js';
import { deleteFromCloudinary } from '../middlewares/cloudinaryUpload.js';
import { sanitizeBlogHtml, sanitizePlainText, decodeEntities } from '../services/contentSanitizer.service.js';

function cleanBlogFieldsAndSave(blog) {
    if (!blog) return blog;
    const doc = typeof blog.toObject === 'function' ? blog.toObject() : { ...blog };
    let needsUpdate = false;
    const fields = ['title', 'metaTitle', 'category', 'publisher', 'metaDesc', 'keywords'];
    for (const f of fields) {
        if (doc[f] && typeof doc[f] === 'string') {
            const cleaned = decodeEntities(doc[f]);
            if (cleaned !== doc[f]) {
                doc[f] = cleaned;
                needsUpdate = true;
            }
        }
    }
    if (needsUpdate && doc._id) {
        Blog.updateOne({ _id: doc._id }, {
            $set: {
                title: doc.title,
                metaTitle: doc.metaTitle,
                category: doc.category,
                publisher: doc.publisher,
                metaDesc: doc.metaDesc,
                keywords: doc.keywords
            }
        }).catch(e => console.warn("Auto-clean DB update warning:", e));
    }
    return doc;
}

function stripBodyH1Tags(content = '') {
    if (!content) return content;
    return String(content).replace(/<h1\b[^>]*>.*?<\/h1>/gis, '');
}

function sanitizeDuplicateTitleHeading(title = '', content = '') {
    if (!title || !content) return content;
    return stripBodyH1Tags(String(content));
}

// Helper to extract Cloudinary URLs from Quill HTML body content for cleanup
function extractCloudinaryUrls(html = '') {
    if (!html || typeof html !== 'string') return [];
    const matches = html.match(/https:\/\/res\.cloudinary\.com\/[^\s"'<>\(\)]+/gi);
    return matches ? [...new Set(matches)] : [];
}

// Upload inline image for Quill rich text editor
export const uploadInlineImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image file uploaded." });
        }
        return res.status(200).json({
            success: true,
            url: req.file.path,
            imageUrl: req.file.path,
            message: "Inline image uploaded successfully!"
        });
    } catch (error) {
        console.error("Inline image upload error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 1. Create and Publish Blog Post
export const createBlogPost = async (req, res) => {
    try {
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl, status } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ success: false, message: "Article title is a required field." });
        }

        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: "Article content is a required field." });
        }

        // Server-side Schema JSON Validation if provided
        if (schema && String(schema).trim()) {
            const rawSchema = String(schema).trim();
            const containsScript = rawSchema.includes('<script');
            if (!containsScript) {
                try {
                    JSON.parse(rawSchema);
                } catch (e) {
                    return res.status(400).json({ success: false, message: "Invalid JSON-LD Schema format provided." });
                }
            }
        }

        // Auto-generate slug from title if slug is missing
        let rawSlug = (slug && String(slug).trim()) ? slug : title;
        let formattedSlug = String(rawSlug).toLowerCase().trim()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!formattedSlug) {
            formattedSlug = `post-${Date.now()}`;
        }

        // Unique Slug Check with auto-suffix if collision occurs
        let existingBlog = await Blog.findOne({ slug: formattedSlug });
        if (existingBlog) {
            formattedSlug = `${formattedSlug}-${Date.now().toString().slice(-4)}`;
        }

        const sanitizedContent = sanitizeBlogHtml(sanitizeDuplicateTitleHeading(title, content));
        const finalCover = req.file ? req.file.path : ((coverUrl || coverImageUrl || "").trim());

        const newBlog = new Blog({
            title: sanitizePlainText(title, 200),
            slug: formattedSlug,
            content: sanitizedContent,
            metaTitle: sanitizePlainText(metaTitle || "", 200),
            keywords: sanitizePlainText(keywords || "", 300),     
            category: sanitizePlainText(category || "Skincare", 100),
            metaDesc: sanitizePlainText(metaDesc || "", 500),
            schema: (schema || "").trim(),       
            publisher: sanitizePlainText(publisher || "Alora Radiance", 100),    
            coverImage: finalCover,
            status: status === 'draft' ? 'draft' : 'published'
        });

        await newBlog.save();
        return res.status(201).json({ 
            success: true, 
            message: "Blog published successfully!", 
            data: newBlog,
            blog: newBlog 
        });

    } catch (error) {
        console.error("Create blog error:", error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "A post with an identical slug already exists. Please try a different title or slug." });
        }
        return res.status(500).json({ success: false, message: error.message || "Could not publish blog post." });
    }
};

// 2. Fetch All Blog Cards (Optimized Projection + Optional Pagination)
export const getAllBlogs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const isPublic = !req.user || req.user.role === 'user';
        const filter = isPublic ? { status: { $ne: 'draft' } } : {};

        // Light Projection excluding heavy rich text content for card listing performance
        const blogs = await Blog.find(filter)
            .select("title slug metaTitle category metaDesc publisher coverImage status createdAt updatedAt")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalCount = await Blog.countDocuments(filter);
        const cleanedBlogs = blogs.map(cleanBlogFieldsAndSave);
        
        return res.status(200).json({ 
            success: true, 
            count: cleanedBlogs.length,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            blogs: cleanedBlogs, 
            data: cleanedBlogs 
        });
    } catch (error) {
        console.error("Fetch all blogs error:", error);
        return res.status(500).json({ success: false, message: error.message || "Could not load blog posts." });
    }
};

// 3. Fetch Single Deep Article Content via Slug OR ID
export const getBlogBySlug = async (req, res) => {
    try {
        const param = req.params.slug;
        
        let blog;
        if (param && param.match(/^[0-9a-fA-F]{24}$/)) {
            blog = await Blog.findById(param);
        }
        if (!blog && param) {
            blog = await Blog.findOne({ slug: param });
        }

        if (!blog) return res.status(404).json({ success: false, message: "Article not found." });
        
        const cleanedBlog = cleanBlogFieldsAndSave(blog);
        return res.status(200).json({ success: true, blog: cleanedBlog, data: cleanedBlog });
    } catch (error) {
        console.error("Fetch blog detail error:", error);
        return res.status(500).json({ success: false, message: error.message || "Could not load article." });
    }
};

// 4. Update Blog
export const updateBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl, status } = req.body;

        const sanitizedContent = content ? sanitizeBlogHtml(sanitizeDuplicateTitleHeading(title || "", content)) : undefined;
        let updateData = {};

        if (title !== undefined) updateData.title = sanitizePlainText(title, 200);
        if (content !== undefined) updateData.content = sanitizedContent;
        if (metaTitle !== undefined) updateData.metaTitle = sanitizePlainText(metaTitle, 200);
        if (keywords !== undefined) updateData.keywords = sanitizePlainText(keywords, 300);
        if (category !== undefined) updateData.category = sanitizePlainText(category, 100);
        if (metaDesc !== undefined) updateData.metaDesc = sanitizePlainText(metaDesc, 500);
        if (schema !== undefined) updateData.schema = String(schema).trim();
        if (publisher !== undefined) updateData.publisher = sanitizePlainText(publisher, 100);
        if (status !== undefined) updateData.status = status === 'draft' ? 'draft' : 'published';

        if (slug) {
            let formattedSlug = String(slug).toLowerCase().trim()
                .replace(/[^a-z0-9-_]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '');

            const existing = await Blog.findOne({ slug: formattedSlug, _id: { $ne: id } });
            if (existing) {
                formattedSlug = `${formattedSlug}-${Date.now().toString().slice(-4)}`;
            }
            updateData.slug = formattedSlug;
        }

        if (req.file) {
            const oldBlog = await Blog.findById(id);
            if (oldBlog && oldBlog.coverImage) {
                try { await deleteFromCloudinary(oldBlog.coverImage); } catch (e) { console.warn("Cloudinary delete warning:", e); }
            }
            updateData.coverImage = req.file.path;
        } else if (coverUrl || coverImageUrl) {
            updateData.coverImage = (coverUrl || coverImageUrl).trim();
        }

        const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found to update." });
        }

        return res.status(200).json({ success: true, message: "Blog updated successfully!", data: updatedBlog, blog: updatedBlog });

    } catch (error) {
        console.error("Update blog error:", error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "A post with an identical slug already exists." });
        }
        return res.status(500).json({ success: false, message: error.message || "Could not update blog post." });
    }
};

// 5. Delete Blog Post (Including Cover Image + Inline Cloudinary Images Cleanup)
export const deleteBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found to delete." });
        }

        // Delete cover image from Cloudinary
        if (deletedBlog.coverImage) {
            try { await deleteFromCloudinary(deletedBlog.coverImage); } catch (e) { console.warn("Cloudinary cover delete warning:", e); }
        }

        // Delete all orphan inline images stored in Cloudinary
        const inlineUrls = extractCloudinaryUrls(deletedBlog.content);
        for (const inlineUrl of inlineUrls) {
            try { await deleteFromCloudinary(inlineUrl); } catch (e) { console.warn("Cloudinary inline delete warning:", e); }
        }

        return res.status(200).json({ success: true, message: "Blog and associated assets deleted successfully!" });
    } catch (error) {
        console.error("Delete blog error:", error);
        return res.status(500).json({ success: false, message: error.message || "Could not delete blog post." });
    }
};