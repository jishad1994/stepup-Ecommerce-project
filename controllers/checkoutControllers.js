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
const Coupon = require("../model/couponSchema.js");

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


            console.log('razor pay hmac',hmac);
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

        //find coupons
        const coupons = await Coupon.find({ isActive: true });

        console.log("Products count:", products.length);

        // Render checkout page
        return res.render("checkout", { cart, addresses, products, coupons });
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

        //check wether coupon is stored iin the session

        const coupon = req.session?.coupon;

        if (coupon) {
            //caluclate the discount
            const cart = await Cart.findOne({ userId: req.user._id });
            console.log("cart is", cart);

            if (!cart) {
                console.log("cart not found");
                return res.status(400).json({ success: false, message: "no cart found" });
            }

            const cartTotal = cart.finalAmount;
            let discountAmount = 0;

            if (coupon.discountType === "percentage") {
                discountAmount = (cartTotal * coupon.discountValue) / 100;
                console.log("discount amount", discountAmount);
                if (coupon.maxDiscountValue) {
                    discountAmount = Math.min(discountAmount, coupon.maxDiscountValue);
                }
            } else {
                discountAmount = coupon.discountValue;
            }

            // Ensure discount doesn't exceed cart total
            let shippingFee = 10;

            discountAmount = Math.min(discountAmount, cartTotal);

            const totalPrice = cartTotal + shippingFee - discountAmount;

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
                totalPrice: totalPrice,
                address,
                orderNotes,

                
                items: cart.items,
                orderId: uniqueId,
                couponApplied: true,
                couponDetails: {
                    couponId: coupon.couponId,
                    couponName: coupon.code,
                    discountAmount: coupon.discountValue,
                    discountType: coupon.discountType,
                },
            });

            // Save the order and delete the cart

            const savedOrder = await order.save();

            //destroy the session from coupon
            req.session.destroy((err) => {
                if (err) {
                    throw new Error("Failed to destroy session");
                }
                // Clear session cookie
                res.clearCookie("connect.sid"); // Replace 'connect.sid' with your session cookie name
                console.log("session DESTROYED SUCCESSFULLY");
            });

            //update the product stock and product purchase count if order placement sucesfull

            const productIds = order.items.map((item) => item.productId);

            const productsToUpdate = await Product.find({ _id: { $in: productIds } });
            const updatedProducts = [];
            order.items.map((item) => {
                const product = productsToUpdate.find((p) => p._id.equals(item.productId));
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
        } else {
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
            const updatedProducts = [];
            order.items.map((item) => {
                const product = productsToUpdate.find((p) => p._id.equals(item.productId));
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
        }
    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
    }
};

//apply Coupon

const applyCoupon = async (req, res) => {
    try {
        const { couponId } = req.body;
        if (!couponId) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required",
            });
        }

        const coupon = await Coupon.findOne({
            _id: couponId,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Invalid or expired coupon",
            });
        }

        // Calculate discount
        const cart = await Cart.findOne({ userId: req.user._id });
        console.log("cart is", cart);
        if (!cart) {
            console.log("cart not found");
            return res.status(400).json({ success: false, message: "no cart found" });
        }
        const cartTotal = cart.finalAmount;
        console.log("cart final amount", cart.finalAmount);
        console.log("coupon.maxDiscountValue", coupon.maxDiscountValue);
        let discountAmount = 0;

        if (coupon.discountType === "percentage") {
            discountAmount = (cartTotal * coupon.discountValue) / 100;
            console.log("discount amount", discountAmount);
            if (coupon.maxDiscountValue) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscountValue);
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        // Ensure discount doesn't exceed cart total
        let shippingFee = 10;
        discountAmount = Math.min(discountAmount, cartTotal);
        const totalAmount = cartTotal + shippingFee - discountAmount;

        // Store coupon details in session
        req.session.coupon = {
            couponId: coupon._id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discountAmount,
            totalAmount: totalAmount,
            appliedAt: new Date(),
        };

        // Save session explicitly if needed (depends on your session configuration)
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                resolve();
            });
        });

        console.log("session data is", req.session);

        res.json({
            success: true,
            discountAmount,
            totalAmount,
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
            },
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to apply coupon",
        });
    }
};

// Helper function to remove coupon from session
const removeCoupon = async (req, res) => {
    try {
        // Remove coupon from session
        delete req.session.coupon;

        // Save session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({
            success: true,
            message: "Coupon removed successfully",
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove coupon",
        });
    }
};

module.exports = { loadCheckout, placeOrder, rzpCreateOrder, rzpVerifyPayment, applyCoupon };
