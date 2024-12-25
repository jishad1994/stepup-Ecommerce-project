const mongoose = require("mongoose");
const Cart = require("../model/cartSchema");
const Category = require("../model/categoryModel");
const User = require("../model/userModel");
const Product = require("../model/productModel");

//loda the cart page
const loadCartPage = async (req, res) => {
    try {
        const email = req.user?.email;

        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("cart", { cart: {}, products: [] });
        }

        const userId = user._id;

        // Find the user's cart
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            let subtotal = 0;
            return res.render("cart", { cart: {}, products: [], subtotal });
        }

        // Fetch the products based on cart items
        const products = await Promise.all(
            cart.items.map(async (cartItem) => {
                const product = await Product.findById(cartItem.productId);
                return { ...product.toObject(), quantity: cartItem.quantity, size: cartItem.size }; // Merge quantity info
            })
        );

        // Calculate the subtotal
        const subtotal = products.reduce((total, product) => total + product.salePrice * product.quantity, 0);

        // Render the cart with its data
        res.render("cart", { cart, products, subtotal });
    } catch (error) {
        console.log("Error while rendering cart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//add to cart
const addToCart = async (req, res) => {
    try {
        console.log("Add to cart controller triggered");
        const { email } = req.user;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const userId = user._id;
        const { productId, quantity, size, price } = req.body.product;

        // Validate input
        if (!productId || !quantity || !price || !size) {
            return res.status(400).json({ success: false, message: "Missing required product details" });
        }

        if (quantity <= 0) {
            return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
        }

        if (quantity > 5) {
            console.log("Attempt to add more than 5 quantity");
            return res.status(400).json({ success: false, message: "You cannot add more than 5 quantity" });
        }

        // Fetch and validate the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found in the database" });
        }

        // Check stock availability for the selected size
        const sizeStock = product.stock.find((item) => item.size === size);
        if (!sizeStock || sizeStock.quantity < quantity) {
            return res.status(400).json({ success: false, message: "Selected size is out of stock" });
        }

        // Find or create a cart for the user
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [{ productId, quantity, price, size: size.toString() }],
            });
        } else {
            // Check if the product already exists in the cart
            const existingItem = cart.items.find(
                (item) => item.productId.toString() === productId && item.size === size.toString()
            );

            if (existingItem) {
                // Update quantity if the product exists
                existingItem.quantity += quantity;

                // Prevent exceeding the stock limit
                if (existingItem.quantity > sizeStock.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: "Exceeding available stock for this size",
                    });
                }

                // Prevent exceeding the purchase limit
                if (existingItem.quantity > 5) {
                    return res.status(400).json({
                        success: false,
                        message: "Exceeding Available purchase Limit",
                    });
                }
            } else {
                // Add a new product to the cart
                cart.items.push({ productId, quantity, price, size: size.toString() });
            }
        }

        // Save the cart
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
        });
    } catch (error) {
        console.error("Error while adding to cart:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unexpected internal server error occurred",
        });
    }
};
//remove item from cart
const removeFromCart = async (req, res) => {
    const { email } = req.user || {};
    const { id: productId, size } = req.query;

    // Early validation of required parameters
    if (!email) {
        return res.status(401).json({ success: false, message: "Unauthorized user" });
    }
    if (!productId || !size) {
        return res.status(400).json({ success: false, message: "Product ID and size are required" });
    }

    try {
        // Use findOneAndUpdate to combine multiple operations
        const cart = await Cart.findOneAndUpdate(
            {
                userId: (await User.findOne({ email }, "_id"))._id,
            },
            {
                $pull: {
                    items: {
                        productId: productId,
                        size: size,
                    },
                },
            },
            { new: true }
        );

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        return res.redirect("/cart")
    } catch (error) {
        console.error("Error removing item from cart:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
};

module.exports = {
    addToCart,
    loadCartPage,
    removeFromCart,
};
