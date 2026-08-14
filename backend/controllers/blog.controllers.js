import Blog from '../models/blog.models.js';
import { deleteFromCloudinary } from '../middlewares/cloudinaryUpload.js';
import { sanitizeBlogHtml, sanitizeHttpUrl, sanitizeJsonObject, sanitizePlainText } from "../services/contentSanitizer.service.js";

// Legacy posts may predate server-side sanitization. Sanitize response content
// as well, so a previously stored unsafe value cannot execute in a visitor's
// browser while editors gradually re-save old posts.
const sanitizeBlogForResponse = (blog) => {
    const value = typeof blog?.toObject === "function" ? blog.toObject() : blog;
    return {
        ...value,
        title: sanitizePlainText(value?.title, 160),
        category: sanitizePlainText(value?.category, 80),
        metaTitle: sanitizePlainText(value?.metaTitle, 160),
        keywords: sanitizePlainText(value?.keywords, 500),
        metaDesc: sanitizePlainText(value?.metaDesc, 320),
        publisher: sanitizePlainText(value?.publisher, 120),
        content: sanitizeBlogHtml(value?.content),
        coverImage: sanitizeHttpUrl(value?.coverImage)
    };
};

// 1. Create and Publish Blog Post
export const createBlogPost = async (req, res) => {
    try {
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl } = req.body;

        if (!title || !slug || !content || !category) {
            return res.status(400).json({ success: false, message: "Required fields are missing." });
        }

        // Slug Formatting
        const cleanTitle = sanitizePlainText(title, 160);
        const cleanCategory = sanitizePlainText(category, 80);
        const formattedSlug = sanitizePlainText(slug, 180).toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const sanitizedContent = sanitizeBlogHtml(content);
        if (!cleanTitle || !cleanCategory || !formattedSlug || !sanitizePlainText(sanitizedContent, 1)) {
            return res.status(400).json({ success: false, message: "Valid title, slug, category and article content are required." });
        }

        // Unique Slug Check
        const existingBlog = await Blog.findOne({ slug: formattedSlug });
        if (existingBlog) {
            return res.status(400).json({ success: false, message: "A post with this slug already exists." });
        }

        let finalCover = sanitizeHttpUrl(coverUrl);
        if (req.file) {
            finalCover = req.file.path; // Cloudinary URL
        }

        const newBlog = new Blog({
            title: cleanTitle,
            slug: formattedSlug,
            content: sanitizedContent,
            metaTitle: sanitizePlainText(metaTitle, 160),
            keywords: sanitizePlainText(keywords, 500),
            category: cleanCategory,
            metaDesc: sanitizePlainText(metaDesc, 320),
            schema: sanitizeJsonObject(schema),
            publisher: sanitizePlainText(publisher, 120),
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
        return res.status(400).json({ success: false, message: error.message || "Blog could not be published." });
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
            blogs: blogs.map(sanitizeBlogForResponse),
            data: blogs.map(sanitizeBlogForResponse)
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
        
        const safeBlog = sanitizeBlogForResponse(blog);
        return res.status(200).json({ success: true, blog: safeBlog, data: safeBlog });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Update Blog (EDIT FUNCTIONALITY)
export const updateBlogPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, slug, content, metaTitle, keywords, category, metaDesc, schema, publisher, coverUrl } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = sanitizePlainText(title, 160);
        if (content !== undefined) {
            updateData.content = sanitizeBlogHtml(content);
            if (!sanitizePlainText(updateData.content, 1)) {
                return res.status(400).json({ success: false, message: "Article content cannot be empty." });
            }
        }
        if (metaTitle !== undefined) updateData.metaTitle = sanitizePlainText(metaTitle, 160);
        if (keywords !== undefined) updateData.keywords = sanitizePlainText(keywords, 500);
        if (category !== undefined) updateData.category = sanitizePlainText(category, 80);
        if (metaDesc !== undefined) updateData.metaDesc = sanitizePlainText(metaDesc, 320);
        if (schema !== undefined) updateData.schema = sanitizeJsonObject(schema);
        if (publisher !== undefined) updateData.publisher = sanitizePlainText(publisher, 120);

        if (slug) {
            updateData.slug = sanitizePlainText(slug, 180).toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        }

        if (req.file) {
            const oldBlog = await Blog.findById(id);
            if (oldBlog && oldBlog.coverImage) {
                await deleteFromCloudinary(oldBlog.coverImage);
            }
            updateData.coverImage = req.file.path; // Cloudinary URL
        } else if (coverUrl !== undefined) {
            updateData.coverImage = sanitizeHttpUrl(coverUrl);
        }

        const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found to update." });
        }

        return res.status(200).json({ success: true, message: "Blog updated successfully!", data: updatedBlog });

    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || "Blog could not be updated." });
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
