import express from 'express';
import upload from '../middlewares/cloudinaryUpload.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { 
    createBlogPost, 
    getAllBlogs, 
    getBlogBySlug, 
    updateBlogPost, 
    deleteBlogPost,
    uploadInlineImage
} from '../controllers/blog.controllers.js';

const router = express.Router();

// Safe upload middleware wrapper to prevent unhandled Multer / Cloudinary crashes
const handleImageUpload = (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
        if (err) {
            console.error("Image upload error:", err);
            if (err.code === 'LIMIT_FILE_SIZE' || err.status === 413) {
                return res.status(400).json({
                    success: false,
                    message: "Image file size is too large. Maximum allowed size is 3.5 MB."
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message || "Image upload failed. Please verify the file format and size."
            });
        }
        next();
    });
};

// 1. Create Blog
router.post('/create', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('coverImage'), createBlogPost);

// 1.5 Inline Editor Image Upload (Uploads to Cloudinary & returns image URL)
router.post('/upload-image', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('image'), uploadInlineImage);

// 2. Get All Blogs
router.get('/', getAllBlogs);
router.get('/all', getAllBlogs);

// 3. Get Single Blog by Slug or ID
router.get('/post/:slug', getBlogBySlug);
router.get('/:slug', getBlogBySlug);

// 4. Update / Edit Blog
router.put('/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('coverImage'), updateBlogPost);
router.put('/update/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('coverImage'), updateBlogPost);

// 5. Delete Blog
router.delete('/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), deleteBlogPost);
router.delete('/delete/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), deleteBlogPost);

export default router;
