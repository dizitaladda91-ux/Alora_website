import Blog from '../models/blog.models.js';
import fs from 'fs';
import { deleteFromCloudinary } from '../middlewares/cloudinaryUpload.js';

function normalizeTitleText(value = '') {
    return String(value).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripBodyH1Tags(content = '') {
    if (!content) return content;

    return String(content).replace(/<h1\b[^>]*>.*?<\/h1>/gis, '');
}

function sanitizeDuplicateTitleHeading(title = '', content = '') {
    if (!title || !content) return content;

    const normalizedContent = String(content);
    const withoutH1 = stripBodyH1Tags(normalizedContent);
    return withoutH1;
}

// 1. Create and Publish Blog Post
export const createBlogPost = async (req, res) => {
    try {
        console.log("=== RECEIVED BODY ===", req.body);

        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl } = req.body;

        if (!title || !slug || !content || !category) {
            return res.status(400).json({ success: false, message: "Required fields are missing." });
        }

        // Slug Formatting
        const formattedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');

        // Unique Slug Check
        const existingBlog = await Blog.findOne({ slug: formattedSlug });
        if (existingBlog) {
            return res.status(400).json({ success: false, message: "A post with this slug already exists." });
        }

        let finalCover = coverUrl || "";
        if (req.file) {
            finalCover = req.file.path; // Cloudinary URL
        }

        const sanitizedContent = sanitizeDuplicateTitleHeading(title, content);

        const newBlog = new Blog({
            title,
            slug: formattedSlug,
            content: sanitizedContent,
            metaTitle,
            keywords,     
            category,
            metaDesc,
            schema,       
            publisher,    
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

// 2. Fetch All Blog Cards (FIXED RESPONSE FORMAT)
export const getAllBlogs = async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1 });
        
        // Response me `blogs` aur `data` dono bhej rahe hain taaki frontend parsing fail na ho
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
        
        // Check if param is ID or Slug
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

// 4. Update Blog (EDIT FUNCTIONALITY)
export const updateBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl } = req.body;

        const sanitizedContent = sanitizeDuplicateTitleHeading(title, content);
        let updateData = { title, content: sanitizedContent, metaTitle, keywords, category, metaDesc, schema, publisher };

        if (slug) {
            updateData.slug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        }

        if (req.file) {
            const oldBlog = await Blog.findById(id);
            if (oldBlog && oldBlog.coverImage) {
                await deleteFromCloudinary(oldBlog.coverImage);
            }
            updateData.coverImage = req.file.path; // Cloudinary URL
        } else if (coverUrl) {
            updateData.coverImage = coverUrl;
        }

        const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found to update." });
        }

        return res.status(200).json({ success: true, message: "Blog updated successfully!", data: updatedBlog });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Delete Blog Post (DELETE FUNCTIONALITY)
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