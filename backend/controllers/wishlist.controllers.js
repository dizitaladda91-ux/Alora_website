import User from "../models/userAuth.models.js";
import SimpleProduct from "../models/product.models.js";

export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const validWishlist = (user.wishlist || []).filter(Boolean);
    return res.status(200).json({ success: true, data: validWishlist });
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

    const stringId = String(productId);
    const existingIndex = user.wishlist.findIndex(id => String(id) === stringId);

    let isAdded = false;
    if (existingIndex > -1) {
      user.wishlist.splice(existingIndex, 1);
      isAdded = false;
    } else {
      user.wishlist.push(productId);
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
