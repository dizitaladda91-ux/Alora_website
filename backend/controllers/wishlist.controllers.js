import mongoose from "mongoose";
import User from "../models/userAuth.models.js";
import SimpleProduct from "../models/product.models.js";

export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const rawWishlistIds = (user.wishlist || []).filter(Boolean);
    if (!rawWishlistIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Direct collection query by IDs is 100% reliable
    const products = await SimpleProduct.find({ _id: { $in: rawWishlistIds } }).lean();

    const formattedProducts = products.map(p => ({
      _id: p._id,
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.variants?.[0]?.price || p.price || 0,
      comparePrice: p.variants?.[0]?.comparePrice || p.comparePrice || p.mrp || 0,
      imagepath: p.imagepath,
      category: p.category,
      isBestseller: p.isBestseller,
      rating: p.rating
    }));

    return res.status(200).json({ success: true, data: formattedProducts });
  } catch (error) {
    console.error("GET_WISHLIST_ERROR:", error);
    return res.status(500).json({ success: false, message: "Could not load wishlist." });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!Array.isArray(user.wishlist)) user.wishlist = [];

    // Resolve product ID (handle either valid ObjectId or product slug)
    let targetObjectId = null;
    const rawId = String(productId).trim();
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      targetObjectId = rawId;
    } else {
      const prod = await SimpleProduct.findOne({ slug: rawId }).select("_id").lean();
      if (prod) {
        targetObjectId = String(prod._id);
      }
    }

    if (!targetObjectId) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const targetStr = String(targetObjectId);
    const existingIndex = user.wishlist.findIndex(id => String(id?._id || id) === targetStr);

    let isAdded = false;
    if (existingIndex > -1) {
      user.wishlist.splice(existingIndex, 1);
      isAdded = false;
    } else {
      user.wishlist.push(targetObjectId);
      isAdded = true;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      isAdded,
      message: isAdded ? "Product added to wishlist!" : "Product removed from wishlist.",
      wishlistCount: user.wishlist.length,
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error("TOGGLE_WISHLIST_ERROR:", error);
    return res.status(500).json({ success: false, message: "Could not update wishlist." });
  }
};
