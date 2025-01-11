const mongoose = require("mongoose");
const Cart = require("../model/cartSchema");
const Category = require("../model/categoryModel");
const User = require("../model/userModel");
const Product = require("../model/productModel");

//loda the cart page
const loadCartPage = async (req, res) => {
    try {
        const email = req.user?.email;

        //destroy the session from coupon
        req.session.destroy((err) => {
            if (err) {
                throw new Error("Failed to destroy session");
            }
            // Clear session cookie
            res.clearCookie("connect.sid"); // Replace 'connect.sid' with your session cookie name
            console.log("session DESTROYED SUCCESSFULLY");
        });

        console.log("session in cart is ", req.session);

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

        const subtotal = products.reduce((total, product) => {
            if (product.offerPrice && product.isOfferApplied) {
                total += product.offerPrice * product.quantity;
            } else {
                total += product.salePrice * product.quantity;
            }
            return total;
        }, 0);

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
        if (!email) {
            return res.redirect("/login");
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const userId = user._id;
        const { productId, quantity, size } = req.body.product;

        // Validate input
        if (!productId || !quantity || !size) {
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

        //find the price of the produtc by chacking wether any offer price is there

        let price = 0;
        if (product.isOfferApplied) {
            price = product.offerPrice;
        } else {
            price = product.salePrice;
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

//remove single item from cart
const removeFromCart = async (req, res) => {
    const { email } = req.user || {};
    const { id: productId, size } = req.query;

    if (!email) {
        return res.status(401).json({ success: false, message: "Unauthorized user" });
    }
    if (!productId || !size) {
        return res.status(400).json({ success: false, message: "Product ID and size are required" });
    }

    try {
        // Fetch the cart for the logged-in user
        const cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        // Filter out the item to be removed
        cart.items = cart.items.filter((item) => item.productId.toString() !== productId.toString() || item.size !== size);

        // Recalculate the total price and final amount
        cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
        cart.finalAmount = cart.totalPrice;

        // Save the updated cart
        await cart.save();

        return res.redirect("/cart");
    } catch (error) {
        console.error("Error removing item from cart:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
};

const updateCart = async (req, res) => {
    try {
        const { productId, size, quantity } = req.body;
        console.log(req.body);

        // Validate quantity
        if (quantity < 1 || quantity > 5) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        // Validate inputs
        if (!productId || !size) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        // Get the user's cart
        const userId = req.user._id;
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        // Find the item in the cart
        const item = cart.items.find((item) => item.productId.toString() === productId && item.size === size);
        if (!item) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        // Get the product to check stock
        const product = await Product.findOne({ _id: item.productId });
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not available" });
        }

        // Find the size's stock
        const sizeStock = product.stock.find((s) => s.size === size);
        if (!sizeStock || sizeStock.quantity < quantity) {
            return res.status(400).json({ success: false, message: "Insufficient stock for selected size" });
        }

        // Update quantity in cart
        item.quantity = quantity;
        await cart.save();

        return res.status(200).json({ success: true, message: "Cart updated successfully", cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    addToCart,
    loadCartPage,
    removeFromCart,
    updateCart,
};
