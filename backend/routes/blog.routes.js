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

// Helper to detect if a request is a direct browser address-bar visit
const isBrowserVisit = (req) => {
    const accept = req.headers['accept'] || '';
    return accept.includes('text/html') && !req.xhr && !req.headers['x-requested-with'];
};

// 2. Get All Blogs (Redirects browser address bar visits to /blog, serves JSON for API/fetch)
router.get('/', (req, res, next) => {
    if (isBrowserVisit(req)) {
        return res.redirect(302, '/blog');
    }
    return getAllBlogs(req, res, next);
});

router.get('/all', (req, res, next) => {
    if (isBrowserVisit(req)) {
        return res.redirect(302, '/blog');
    }
    return getAllBlogs(req, res, next);
});

// 3. Get Single Blog by Slug or ID (Redirects browser address bar visits to /post/:slug, serves JSON for API/fetch)
router.get('/post/:slug', (req, res, next) => {
    if (isBrowserVisit(req)) {
        return res.redirect(302, `/post/${encodeURIComponent(req.params.slug)}`);
    }
    return getBlogBySlug(req, res, next);
});

router.get('/:slug', (req, res, next) => {
    if (isBrowserVisit(req)) {
        return res.redirect(302, `/post/${encodeURIComponent(req.params.slug)}`);
    }
    return getBlogBySlug(req, res, next);
});

// 4. Update / Edit Blog
router.put('/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('coverImage'), updateBlogPost);
router.put('/update/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), handleImageUpload('coverImage'), updateBlogPost);

// 5. Delete Blog
router.delete('/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), deleteBlogPost);
router.delete('/delete/:id', requireAuth, authorizeRoles('admin', 'seoadmin'), deleteBlogPost);

export default router;
