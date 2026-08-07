import express from "express";
import upload from "../middlewares/cloudinaryUpload.js";
import { 
    addnewproduct, 
    deleteproduct, 
    getproductbyid, 
    readproduct, 
    updateproduct,
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
router.post("/add", (req, res, next) => {
    upload.single('imagepath')(req, res, (err) => {
        if (err) {
            // Multer error handling
            return res.status(400).json({ error: err.message });
        }
        // Agar koi error nahi hai toh controller trigger hoga
        addnewproduct(req, res, next);
    });
});

// PUT: Product update karne ke liye (Single Image Upload optional)
router.put("/update/:id", upload.single('imagepath'), updateproduct);

// DELETE: Product aur uski image remove karne ke liye
router.delete("/delete/:id", deleteproduct);

export default router;