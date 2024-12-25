const mongoose = require("mongoose");
const env = require("dotenv").config();
// *****//
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Wishlist = require("../model/wishlistSchema.js");
const Cart = require("../model/cartSchema.js");
const Order = require("../model/orderModel.js");

//razor pay
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET,
});

//rzp create order controller

const rzpCreateOrder = async (req, res) => {
    try {
        const { amount, currency } = req.body;

        // Convert amount to smallest currency unit (e.g., paise for INR)
        const options = {
            amount: amount * 100, // ₹1 -> 100 paise
            currency: currency || "INR",
            receipt: `order_rcptid_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        console.log("entered create order controller", order);
        res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            rzp_key: process.env.RZP_KEY_ID,
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, message: "Failed to create order." });
    }
};

//razorpay checkout controller

const rzpVerifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const hmac = crypto
            .createHmac("sha256", process.env.RZP_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (hmac === razorpay_signature) {
            res.status(200).json({ success: true, message: "Payment verified successfully." });
        } else {
            res.status(400).json({ success: false, message: "Payment verification failed." });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Payment verification error." });
    }
};

// Load checkout page//
const loadCheckout = async (req, res) => {
    try {
        console.log("Checkout controller invoked");

        // Validate user ID
        const userId = req.user?._id;
        console.log("User ID:", userId);

        if (!userId) {
            console.log("User not authenticated");
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        // Fetch cart and addresses simultaneously
        const [cart, addresses] = await Promise.all([Cart.findOne({ userId }), Address.find({ userId })]);

        if (!cart || cart.items.length === 0) {
            console.log("Cart is empty or not found");
            return res.status(404).json({ success: false, message: "Cart is empty" });
        }

        console.log("Cart items count:", cart.items.length);
        console.log("Address count:", addresses.length);

        // Extract product IDs and fetch products
        const productIds = cart.items.map((item) => item.productId);
        console.log("product ids:", productIds);
        const products = await Product.find({ _id: { $in: productIds } });

        if (!products || products.length === 0) {
            console.log("No products found for the cart items");
            return res.status(404).json({ success: false, message: "Products not found for the cart items" });
        }

        console.log("Products count:", products.length);

        // Render checkout page
        return res.render("checkout", { cart, addresses, products });
    } catch (error) {
        console.error("Internal server error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//place order
const placeOrder = async (req, res) => {
    try {
        // Destructure the request body
        const {
            addressType,
            fullName,
            phone,
            altPhone,
            state,
            city,
            landmark,
            pincode,
            paymentMethod,
            orderNotes,
        } = req.body;

        // Validate required fields
        if (!addressType || !fullName || !state || !city || !pincode || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Please fill all the required details." });
        }

        // Fetch the user ID
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart || !cart.items.length) {
            return res.status(400).json({ success: false, message: "Cart is empty or not found." });
        }

        // Helper function to check product availability
        const checkProductAvailability = async (cartItems) => {
            const productIds = cartItems.map((item) => item.productId);
            const products = await Product.find({ _id: { $in: productIds } });

            return cartItems.reduce((outOfStock, cartItem) => {
                const product = products.find((p) => p._id.equals(cartItem.productId));
                const stockItem = product?.stock.find((s) => s.size === cartItem.size);

                if (!product || !stockItem || stockItem.quantity < cartItem.quantity) {
                    outOfStock.push({
                        productId: cartItem.productId,
                        productName: product?.productName || "Unknown product",
                        requestedSize: cartItem.size,
                        requestedQuantity: cartItem.quantity,
                        availableQuantity: stockItem?.quantity || 0,
                    });
                }

                return outOfStock;
            }, []);
        };

        // Check product availability
        const outOfStockProducts = await checkProductAvailability(cart.items);
        if (outOfStockProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some products are out of stock.",
                outOfStockProducts,
            });
        }

        // Calculate the total price
        const shippingFee = 10; // Fixed shipping fee
        const totalPrice = cart.finalAmount + shippingFee;

        // Function to generate a unique 5- or 6-digit order ID
        async function generateOrderId() {
            try {
                const min = 10000;
                const max = 999999;
                let uniqueId;

                do {
                    uniqueId = Math.floor(Math.random() * (max - min + 1)) + min;
                    const existingOrder = await Order.findOne({ orderId: uniqueId });
                    if (!existingOrder) break;
                } while (true);
                console.log("unque id is", uniqueId);

                return uniqueId.toString();
            } catch (error) {
                console.error("Error generating orderId:", error);
                throw new Error("Failed to generate orderId");
            }
        }

        const uniqueId = await generateOrderId();

        // Prepare order data
        const address = { userId, addressType, fullName, phone, altPhone, state, city, landmark, pincode };
        const order = new Order({
            userId,
            paymentType: paymentMethod,
            shippingFee,
            totalPrice,
            address,
            orderNotes,
            items: cart.items,
            orderId: uniqueId,
        });

        // Save the order and delete the cart

        const savedOrder = await order.save();

        //update the product stock and product purchase count if order placement sucesfull

        const productIds = order.items.map((item) => item.productId);

        const productsToUpdate = await Product.find({ _id: { $in: productIds } });
        console.log("products to update", productsToUpdate);
        const updatedProducts = [];
        order.items.map((item) => {
            const product = productsToUpdate.find((p) => p._id.equals(item.productId));
            console.log("product to update", product);
            //increase the purchase count
            product.purchaseCount += item.quantity;

            //adjust quantity of the specific size
            product.stock.map((stockItem, index) => {
                if (stockItem.size == item.size) {
                    product.stock[index].quantity -= item.quantity;
                }
            });

            updatedProducts.push(product);
        });

        const bulkOperations = updatedProducts.map((product) => ({
            updateOne: {
                filter: { _id: product._id },
                update: { $set: { stock: product.stock }, purchaseCount: product.purchaseCount },
            },
        }));

        await Product.bulkWrite(bulkOperations);

        /////

        // Fetch all updated products to recalculate `totalStock`
        const products = await Product.find({ _id: { $in: productIds } });

        // Update `totalStock` and `status` for each product
        await Promise.all(
            products.map(async (product) => {
                product.totalStock = product.stock.reduce((total, item) => total + item.quantity, 0);
                product.status = product.totalStock > 0 ? "Available" : "Out of Stock";
                await product.save();
            })
        );

        //////

        //delete the cart after successfll order placement
        await Cart.deleteOne({ userId });

        return res.status(200).json({
            success: true,
            message: `Order placed successfully. Order ID:${savedOrder.orderId}`,
            orderId: savedOrder.orderId,
        });
    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
    }
};

module.exports = { loadCheckout, placeOrder, rzpCreateOrder, rzpVerifyPayment };
