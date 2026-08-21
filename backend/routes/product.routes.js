import express from "express";
import upload from "../middlewares/cloudinaryUpload.js";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { 
    addnewproduct, 
    deleteproduct, 
    getproductbyid, 
    readproduct, 
    updateproduct,
    updateProductForSeo,
    searchProducts
} from "../controllers/product.controllers.js";

const router = express.Router();

// 4. Routes Definition

// GET: Saare products
router.get("/all", readproduct);

// GET: Product Search by query (MUST be defined before /:id route)
router.get("/search", searchProducts);

// GET: Single product ID ke saath
router.get("/:id", getproductbyid);

// POST: Naya product add karne ke liye (Single Image Upload)
// Post Route with custom Multer error handling
const productUploadFields = upload.fields([
    { name: 'imagepath', maxCount: 1 },
    { name: 'galleryImages', maxCount: 6 },
    { name: 'productVideo', maxCount: 1 }
]);

router.post("/add", requireAuth, authorizeRoles("admin"), (req, res, next) => {
    productUploadFields(req, res, (err) => {
        if (err) {
            // Multer error handling
            return res.status(400).json({ error: err.message });
        }
        // Agar koi error nahi hai toh controller trigger hoga
        addnewproduct(req, res, next);
    });
});

// PUT: Product update karne ke liye (Single Image Upload optional)
router.put("/update/:id", requireAuth, authorizeRoles("admin"), productUploadFields, updateproduct);

// SEO users may edit only image, description, rating and ML/volume measurements.
router.put("/seo-update/:id", requireAuth, authorizeRoles("admin", "seoadmin"), productUploadFields, updateProductForSeo);

// DELETE: Product aur uski image remove karne ke liye
router.delete("/delete/:id", requireAuth, authorizeRoles("admin"), deleteproduct);

export default router;
