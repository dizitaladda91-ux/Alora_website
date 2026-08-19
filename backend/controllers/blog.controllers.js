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

// 1. Create and Publish Blog Post
export const createBlogPost = async (req, res) => {
    try {
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl } = req.body;

        if (!title || !slug || !content || !category) {
            return res.status(400).json({ success: false, message: "Title, slug, content, and category are mandatory fields." });
        }

        // Slug Formatting
        const formattedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');

        // Unique Slug Check
        const existingBlog = await Blog.findOne({ slug: formattedSlug });
        if (existingBlog) {
            return res.status(400).json({ success: false, message: "A post with this slug already exists." });
        }

        let finalCover = (req.file ? req.file.path : (coverUrl || coverImageUrl || "")).trim();
        const sanitizedContent = sanitizeDuplicateTitleHeading(title, content);

        const newBlog = new Blog({
            title: title.trim(),
            slug: formattedSlug,
            content: sanitizedContent,
            metaTitle: (metaTitle || "").trim(),
            keywords: (keywords || "").trim(),     
            category: (category || "").trim(),
            metaDesc: (metaDesc || "").trim(),
            schema: (schema || "").trim(),       
            publisher: (publisher || "").trim(),    
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
        return res.status(500).json({ success: false, message: error.message });
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
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Fetch Single Deep Article Content via Slug OR ID
export const getBlogBySlug = async (req, res) => {
    try {
        const param = req.params.slug;
        
        let blog;
        if (param.match(/^[0-9a-fA-F]{24}$/)) {
            blog = await Blog.findById(param);
        } else {
            blog = await Blog.findOne({ slug: param });
        }

        if (!blog) return res.status(404).json({ success: false, message: "Article not found." });
        
        return res.status(200).json({ success: true, blog, data: blog });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Update Blog
export const updateBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl, coverImageUrl } = req.body;

        const sanitizedContent = sanitizeDuplicateTitleHeading(title, content);
        let updateData = { 
            title: title ? title.trim() : undefined, 
            content: sanitizedContent, 
            metaTitle: metaTitle ? metaTitle.trim() : undefined, 
            keywords: keywords ? keywords.trim() : undefined, 
            category: category ? category.trim() : undefined, 
            metaDesc: metaDesc ? metaDesc.trim() : undefined, 
            schema: schema ? schema.trim() : undefined, 
            publisher: publisher ? publisher.trim() : undefined 
        };

        if (slug) {
            const formattedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
            const existing = await Blog.findOne({ slug: formattedSlug, _id: { $ne: id } });
            if (existing) {
                return res.status(400).json({ success: false, message: "Another post with this slug already exists." });
            }
            updateData.slug = formattedSlug;
        }

        if (req.file) {
            const oldBlog = await Blog.findById(id);
            if (oldBlog && oldBlog.coverImage) {
                await deleteFromCloudinary(oldBlog.coverImage);
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
        return res.status(500).json({ success: false, message: error.message });
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
            await deleteFromCloudinary(deletedBlog.coverImage);
        }

        return res.status(200).json({ success: true, message: "Blog deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};