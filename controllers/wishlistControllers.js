const mongoose = require("mongoose");
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const env = require("dotenv").config();
const Address = require("../model/addressModel.js");
const Wishlist = require("../model/wishlistSchema.js");

//add to wishlist
const addToWishlist = async (req, res) => {
    try {
        const { productId: rawProductId, size, quantity } = req.body;

        if (!rawProductId || !size || !quantity) {
            return res.status(400).json({ success: false, message: "Product ID, size, and quantity are required" });
        }

        // Validate and convert productId to ObjectId
        if (!mongoose.Types.ObjectId.isValid(rawProductId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }
        const productId = new mongoose.Types.ObjectId(rawProductId);

        // Fetch the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Find or create the user's wishlist
        const wishlist = await Wishlist.findOneAndUpdate(
            { userId: req.user._id },
            { $setOnInsert: { userId: req.user._id, products: [] } },
            { upsert: true, new: true }
        );

        // Check if the product with the same size already exists in the wishlist
        const existingProduct = wishlist.products.find((item) => item.productId.equals(productId) && item.size === size);

        if (existingProduct) {
            if (existingProduct.quantity + quantity > 5) {
                return res
                    .status(400)
                    .json({ success: false, message: "Cannot add more than 5 quantities of the same product and size" });
            }
            existingProduct.quantity += quantity;
        } else {
            if (quantity > 5) {
                return res.status(400).json({ success: false, message: "Cannot add more than 5 quantities at once" });
            }
            // Add the new product to the wishlist
            wishlist.products.push({ productId, size, quantity });
        }

        // Save the updated wishlist
        await wishlist.save();

        return res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error(`Error adding to wishlist: ${error.message}`);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

//load wishlist

const loadWishlist = async (req, res) => {
    try {
        // Ensure user is authenticated and fetch user details
        const userId = req.user?._id;
        if (!userId) {
            return res.status(400).json({ success: false, message: "Invalid request: User ID missing" });
        }

        const user = await User.findById(userId);

        if (!user) {
            console.error("User not found while loading wishlist");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch user's wishlist
        const wishlist = await Wishlist.findOne({ userId: user._id });

        if (!wishlist || wishlist.products.length === 0) {
            console.log("Wishlist is empty");
            return res.render("wishlist", { products: [] }); // Render empty wishlist view
        }

        // Resolve all product data
        const products = await Promise.all(
            wishlist.products.map(async (item) => {
                try {
                    const product = await Product.findById(item.productId);
                    if (!product) {
                        console.warn(`Product with ID ${item.productId} not found.`);
                        return null; // or a placeholder object
                    }
                    return {
                        ...product.toObject(), // Convert to plain JS object
                        size: item.size,
                        quantity: item.quantity,
                    };
                } catch (error) {
                    console.error(`Error fetching product ID ${item.productId}:`, error);
                    return null; // Handle errors gracefully
                }
            })
        );

        // Filter out any null results (in case a product is missing)
        const filteredProducts = products.filter((product) => product);

        // Render wishlist view
        res.render("wishlist", { products: filteredProducts });
    } catch (error) {
        console.error("Internal server error while loading wishlist:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//delete wishlist

const deleteWishlist = async (req, res) => {
    try {
        const productId = req.query.id;
        const size = req.query.size;

        // Find user from req object
        const user = await User.findOne({ _id: req.user._id });

        if (!user) {
            console.log("no user found");
            return res.status(404).json({ success: false, message: "No user Found" });
        }

        const userId = user._id;

        // Find the wishlist
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: "Wishlist not found",
            });
        }

        // Find the index of the product
        const index = wishlist.products.findIndex(
            (product) => product.productId.toString() === productId && product.size === size.toString()
        );

        // Remove the product if found
        if (index !== -1) {
            wishlist.products.splice(index, 1);
            await wishlist.save();

            return res.json({
                success: true,
                message: "Product removed from wishlist",
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Product not found in wishlist",
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            message: "Error removing product from wishlist",
        });
    }
};

module.exports = {
    addToWishlist,
    loadWishlist,
    deleteWishlist,
};
