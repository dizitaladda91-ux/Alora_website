import express from 'express';
import upload from '../middlewares/cloudinaryUpload.js';
import { 
    createBlogPost, 
    getAllBlogs, 
    getBlogBySlug, 
    updateBlogPost, 
    deleteBlogPost 
} from '../controllers/blog.controllers.js';

const router = express.Router();

// ==========================================
// API Endpoints
// ==========================================

// 1. Create Blog
router.post('/create', upload.single('coverImage'), createBlogPost);

// 2. Get All Blogs (Frontend requests /api/blogs OR /api/blogs/all)
router.get('/', getAllBlogs);
router.get('/all', getAllBlogs);

// 3. Get Single Blog by Slug or ID
// Keep the specific route before /:slug; otherwise "post" is treated as a slug
// and /api/blogs/post/<slug> never reaches the article handler.
router.get('/post/:slug', getBlogBySlug);
router.get('/:slug', getBlogBySlug);

// 4. Update / Edit Blog
router.put('/:id', upload.single('coverImage'), updateBlogPost);
router.put('/update/:id', upload.single('coverImage'), updateBlogPost);

// 5. Delete Blog
router.delete('/:id', deleteBlogPost);
router.delete('/delete/:id', deleteBlogPost);

export default router;
