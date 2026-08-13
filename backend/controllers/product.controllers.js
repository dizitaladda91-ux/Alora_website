import SimpleProduct from "../models/product.models.js";
import fs from "fs";
import { deleteFromCloudinary } from "../middlewares/cloudinaryUpload.js";

// 1. CREATE (Naya Product Add Karna)
export const addnewproduct = async (req, res) => {
    try {
        const { name, description, category, rating, totalReviews, isAvailable } = req.body;
        
        let variants = [];
        if (req.body.variants && req.body.variants !== "") {
            try {
                variants = JSON.parse(req.body.variants);
            } catch (e) {
                return res.status(400).json({ error: "Variants array parsing text format invalid hai!" });
            }
        }

        const addproduct = {
            name,
            description,
            category, 
            rating: rating ? Number(rating) : 4.5,
            totalReviews: totalReviews ? Number(totalReviews) : 0,
            isAvailable: isAvailable === 'true' || isAvailable === true, 
            variants 
        };

        const mainImage = req.files?.imagepath?.[0];
        if (mainImage) addproduct.imagepath = mainImage.path;
        addproduct.galleryImages = (req.files?.galleryImages || []).map((file) => file.path);

        const newProduct = new SimpleProduct(addproduct);
        const savedProduct = await newProduct.save();
        
        res.status(201).json(savedProduct);

    } catch (err) {
        import("fs").then(fs => fs.appendFileSync("error_log.txt", "Controller Error: " + err.stack + "\n"));
        console.error("Controller Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 2. READ (Saare Products Get Karna)
export const readproduct = async (req, res) => {
    try {
        const products = await SimpleProduct.find();
        res.status(200).json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. UPDATE (Product Details Badadna)
export const updateproduct = async (req, res) => {
    try {
        const { id } = req.params;
        let updateProductData = { ...req.body };

        if (req.body.variants) {
            try {
                updateProductData.variants = JSON.parse(req.body.variants);
            } catch (e) {
                // Input validation fallback
            }
        }

        if (req.body.isAvailable !== undefined) {
            updateProductData.isAvailable = req.body.isAvailable === 'true' || req.body.isAvailable === true;
        }
        if (req.body.rating) updateProductData.rating = Number(req.body.rating);
        if (req.body.totalReviews) updateProductData.totalReviews = Number(req.body.totalReviews);

        const mainImage = req.files?.imagepath?.[0];
        const galleryImages = req.files?.galleryImages || [];
        if (mainImage) {
            const oldProduct = await SimpleProduct.findById(id);
            if (oldProduct && oldProduct.imagepath) {
                await deleteFromCloudinary(oldProduct.imagepath);
            }
            updateProductData.imagepath = mainImage.path;
        } else if (req.body.oldProfile) {
            updateProductData.imagepath = req.body.oldProfile;
        }

        delete updateProductData.oldProfile;

        if (galleryImages.length > 0) {
            const oldProduct = await SimpleProduct.findById(id);
            await Promise.all((oldProduct?.galleryImages || []).map(deleteFromCloudinary));
            updateProductData.galleryImages = galleryImages.map((file) => file.path);
        }

        const updatedProduct = await SimpleProduct.findByIdAndUpdate(
            id,
            updateProductData, 
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product database me nahi mila ya update fail hua" });
        }

        res.status(200).json(updatedProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 4. DELETE (Sirf Database se Product Hata Dena)
export const deleteproduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteProduct = await SimpleProduct.findByIdAndDelete(id);
        
        if (!deleteProduct) {
            return res.status(404).json({ message: "Product nahi mila" });
        }

        if (deleteProduct.imagepath) {
            await deleteFromCloudinary(deleteProduct.imagepath);
        }
        await Promise.all((deleteProduct.galleryImages || []).map(deleteFromCloudinary));

        res.status(200).json({ message: "Product successfully deleted!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. GET SINGLE PRODUCT
export const getproductbyid = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await SimpleProduct.findById(id);

        if (!product) {
            return res.status(404).json({ error: "Product nahi mila" });
        }

        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 6. SEARCH PRODUCTS
export const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') {
            return res.status(200).json({ success: true, products: [] });
        }
        const regex = new RegExp(q.trim(), "i");
        const products = await SimpleProduct.find({
            $or: [
                { name: regex },
                { description: regex },
                { category: regex }
            ]
        });
        res.status(200).json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
