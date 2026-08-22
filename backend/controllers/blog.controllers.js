import Blog from '../models/blog.models.js';
import { deleteFromCloudinary } from '../middlewares/cloudinaryUpload.js';

function stripBodyH1Tags(content = '') {
    if (!content) return content;
    return String(content).replace(/<h1\b[^>]*>.*?<\/h1>/gis, '');
}

function sanitizeDuplicateTitleHeading(title = '', content = '') {
    if (!title || !content) return content;
    return stripBodyH1Tags(String(content));
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
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ success: false, message: "Article title is a required field." });
        }

        if (!content || !String(content).trim()) {
            return res.status(400).json({ success: false, message: "Article content is a required field." });
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

        const sanitizedContent = sanitizeDuplicateTitleHeading(title, content);
        const finalCover = req.file ? req.file.path : ((coverUrl || coverImageUrl || "").trim());

        const newBlog = new Blog({
            title: String(title).trim(),
            slug: formattedSlug,
            content: sanitizedContent,
            metaTitle: (metaTitle || "").trim(),
            keywords: (keywords || "").trim(),     
            category: (category || "Skincare").trim(),
            metaDesc: (metaDesc || "").trim(),
            schema: (schema || "").trim(),       
            publisher: (publisher || "Alora Radiance").trim(),    
            coverImage: finalCover
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
        return res.status(500).json({ success: false, message: error.message || "Could not publish blog post." });
    }
};

// 2. Fetch All Blog Cards
export const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        
        return res.status(200).json({ 
            success: true, 
            count: blogs.length,
            blogs: blogs, 
            data: blogs 
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
        
        return res.status(200).json({ success: true, blog, data: blog });
    } catch (error) {
        console.error("Fetch blog detail error:", error);
        return res.status(500).json({ success: false, message: error.message || "Could not load article." });
    }
};

// 4. Update Blog
export const updateBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl } = req.body;

        const sanitizedContent = content ? sanitizeDuplicateTitleHeading(title || "", content) : undefined;
        let updateData = {};

        if (title !== undefined) updateData.title = String(title).trim();
        if (content !== undefined) updateData.content = sanitizedContent;
        if (metaTitle !== undefined) updateData.metaTitle = String(metaTitle).trim();
        if (keywords !== undefined) updateData.keywords = String(keywords).trim();
        if (category !== undefined) updateData.category = String(category).trim();
        if (metaDesc !== undefined) updateData.metaDesc = String(metaDesc).trim();
        if (schema !== undefined) updateData.schema = String(schema).trim();
        if (publisher !== undefined) updateData.publisher = String(publisher).trim();

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
        return res.status(500).json({ success: false, message: error.message || "Could not update blog post." });
    }
};

// 5. Delete Blog Post
export const deleteBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found to delete." });
        }

        if (deletedBlog.coverImage) {
            try { await deleteFromCloudinary(deletedBlog.coverImage); } catch (e) { console.warn("Cloudinary delete warning:", e); }
        }

        return res.status(200).json({ success: true, message: "Blog deleted successfully!" });
    } catch (error) {
        console.error("Delete blog error:", error);
        return res.status(500).json({ success: false, message: error.message || "Could not delete blog post." });
    }
};