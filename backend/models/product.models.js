import mongoose from "mongoose";

// 1. Variant Schema (Flexible Volume: allows 100g, 50ml, Combo, Kit, etc.)
const ProductVariantSchema = new mongoose.Schema({
    volume: { 
        type: String,
        required: [true, 'Variant ka volume zaroori hai'],
        trim: true
    },
    price: { 
        type: Number, 
        required: [true, 'Is variant ki offer price zaroori hai'], 
        min: 0 
    },
    comparePrice: { 
        type: Number, 
        min: 0 
    },
    stock: { 
        type: Number, 
        required: true, 
        default: 10 
    }
});

// 2. Main Product Schema
const SimpleProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name zaroori hai'],
        trim: true
    },
    // Public storefront URLs use this readable value instead of exposing a MongoDB ID.
    slug: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true
    },
    description: {
        type: String,
        required: [true, 'Product description zaroori hai'],
        trim: true
    },
    sku: { type: String, trim: true, unique: true, sparse: true },
    ingredients: { type: String, trim: true, default: '' },
    benefits: { type: String, trim: true, default: '' },
    usageInstructions: { type: String, trim: true, default: '' },
    isBestseller: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    metaTitle: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    category: {
        type: String,
        required: [true, 'Product category zaroori hai'],
        enum: {
            values: ['skin', 'face', 'cream', 'body', 'combo'],
            message: '{VALUE} valid category nahi hai. Choose from: skin, face, cream, body, combo'
        },
        trim: true
    },
    imagepath: {
        type: String,
        required: [true, 'Product image path zaroori hai']
    },
    galleryImages: [{ 
        type: String
    }],
    variants: {
        type: [ProductVariantSchema],
        validate: [v => v.length > 0, 'Kam se kam ek product variant hona zaroori hai']
    },
    isAvailable: { 
        type: Boolean, 
        default: true 
    },
    rating: {
        type: Number,
        default: 4.5,
        min: 0,
        max: 5
    },
    totalReviews: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const SimpleProduct = mongoose.model('SimpleProduct', SimpleProductSchema);
export default SimpleProduct;
