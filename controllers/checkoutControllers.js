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
const Wallet = require("../model/walletModel.js");

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
        const userId = req.user._id;
        const { currency, amount, orderId } = req.body;

        let shippingCharge = 10;

        // Determine the amount to be charged

        if (!amount || isNaN(amount) || amount <= 0) {
            console.log("invalid amount provided");
            return res.status(400).json({ success: false, message: "Invalid amount provided" });
        }

        // Razorpay order options
        const options = {
            amount: Math.round(amount * 100), // Convert to smallest currency unit
            currency: currency || "INR",
            receipt: `order_${orderId}`,
            payment_capture: 1,
        };
        console.log("after cretng options");
        // Create the Razorpay order
        const order = await razorpay.orders.create(options);
        console.log("order data recieved while creating rzp order is", order);

        // Send response
        res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            rzp_key: process.env.RZP_KEY_ID,
        });
    } catch (error) {
        console.error("Error creating Razorpay order for user:", req.user._id, error);
        res.status(500).json({ success: false, message: "Failed to create order." });
    }
};

//razorpay checkout controller
const rzpVerifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, _id } = req.body;

        const hmac = crypto
            .createHmac("sha256", process.env.RZP_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        console.log("razor pay hmac", hmac);
        if (hmac === razorpay_signature) {
            // Payment verified successfully
            await Order.findByIdAndUpdate(_id, {
                paymentStatus: "Success",
                paymentDetails: {
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    status: "Success",
                    paymentMethod: "razorPay",
                },
            });

            res.status(200).json({
                success: true,
                message: "Payment verified successfully.",
                razorpay_order_id,
                razorpay_payment_id,
            });
        } else {
            // Payment verified successfully
            await Order.findByIdAndUpdate(_id, {
                paymentStatus: "Failed",
            });

            res.status(400).json({ success: false, message: "Payment verification failed." });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({
            success: false,
            message: "Payment verification error.",
        });
    }
};

// Load Checkout Page
// Load Checkout Page

const loadCheckout = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            console.log("User not authenticated");
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        // Remove the coupon from the session
        if (req.session.coupon) {
            delete req.session.coupon;
            console.log("Coupon removed from session on page reload");
        }

        // Fetch cart and addresses
        const [cart, addresses] = await Promise.all([Cart.findOne({ userId }), Address.find({ userId })]);

        if (!cart || cart.items.length === 0) {
            return res.status(404).json({ success: false, message: "Cart is empty" });
        }

        // Fetch product details
        const productIds = cart.items.map((item) => item.productId);
        const products = await Product.find({ _id: { $in: productIds } });

        if (!products || products.length === 0) {
            return res.status(404).json({ success: false, message: "Products not found for the cart items" });
        }

        // Fetch all active coupons
        const allCoupons = await Coupon.find({
            isActive: true,
            endDate: { $gt: new Date() },
        });

        // Fetch user's coupon usage
        const usedCoupons = await Order.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), couponApplied: true } },
            {
                $group: {
                    _id: "$couponDetails.couponId", // Group by coupon ID
                    count: { $sum: 1 }, // Count the usage
                },
            },
        ]);

        // Create a map of used coupons for quick lookup
        const usedCouponMap = usedCoupons.reduce((map, item) => {
            map[item._id.toString()] = item.count;
            return map;
        }, {});

        // Filter eligible coupons
        const eligibleCoupons = allCoupons.filter((coupon) => {
            const usageCount = usedCouponMap[coupon._id.toString()] || 0;
            return usageCount < coupon.userUsageLimit && coupon.usedCount < coupon.usageLimit;
        });

        console.log("Eligible Coupons:", eligibleCoupons);

        // Render checkout page
        return res.render("checkout", { cart, addresses, products, coupons: eligibleCoupons });
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
            const productData = outOfStockProducts.map(
                (product) => `${product.productName} with size ${product.requestedSize}`
            );
            return res.status(400).json({
                success: false,
                message: `${productData.join(", ")} are out of stock.`,
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

                console.log("max discount value and its type", coupon.maxDiscountValue, typeof maxDiscountValue);
                if (coupon.maxDiscountValue > 0) {
                    discountAmount = Math.min(discountAmount, coupon.maxDiscountValue);
                    console.log("final discount amount from math min:", discountAmount);
                }
            } else {
                discountAmount = coupon.discountValue;
                console.log("final discount amount from else caes:", discountAmount);
            }

            // Ensure discount doesn't exceed cart total
            let shippingFee = 10;

            discountAmount = Math.min(discountAmount, cartTotal);

            console.log("final discount amount:", discountAmount);

            const totalPrice = cartTotal - discountAmount + shippingFee;
            console.log("total price while placing order is", totalPrice);

            if (paymentMethod == "COD" && totalPrice >= 1000) {
                console.log("Cod order amonutn more than 1000");
                return res
                    .status(400)
                    .json({ success: false, message: "Cash On Delivery Is Not Available For Orders More Than  ₹ 1000 " });
            }

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

            //calculate total items

            const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

            const uniqueId = await generateOrderId();

            // Prepare order data
            const address = { userId, addressType, fullName, phone, altPhone, state, city, landmark, pincode };
            let order;
            if (paymentMethod === "Online") {
                console.log("payment method is online");
                order = new Order({
                    userId,
                    paymentType: paymentMethod,
                    paymentStatus: "Not Paid",
                    shippingFee,
                    totalItems,
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
            } else {
                if (paymentMethod == "COD" && totalPrice >= 1000) {
                    console.log("Cod order amonutn more than 1000");
                    return res.status(400).json({
                        success: false,
                        message: "Cash On Delivery Is Not Available For Orders More Than  ₹ 1000 ",
                    });
                }

                order = new Order({
                    userId,
                    paymentType: paymentMethod,
                    shippingFee,
                    paymentStatus: "Not Paid",
                    totalItems,
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
            }

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
                amount: savedOrder.totalPrice,
                _id: savedOrder._id,
            });
        } else {
            const totalPrice = cart.finalAmount + shippingFee;

            if (paymentMethod == "COD" && totalPrice >= 1000) {
                console.log("Cod order amonutn more than 1000");
                return res
                    .status(400)
                    .json({ success: false, message: "Cash On Delivery Is Not Available For Orders More Than  ₹ 1000 " });
            }

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
            //total items
            const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
            // Prepare order data
            const address = { userId, addressType, fullName, phone, altPhone, state, city, landmark, pincode };

            const order = new Order({
                userId,
                paymentType: paymentMethod,
                shippingFee,
                totalPrice,
                totalItems,
                address,
                orderNotes,
                items: cart.items,
                orderId: uniqueId,
                paymentStatus: "Not Paid",
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
                amount: savedOrder.totalPrice,
                _id: savedOrder._id,
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

        // Validate input
        if (!couponId) {
            return res.status(400).json({
                success: false,
                message: "Coupon ID is required",
            });
        }

        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User authentication required",
            });
        }

        // Fetch the coupon
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

        // Check coupon usage limits
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: "Coupon usage limit exceeded",
            });
        }

        // Check user-specific usage limit
        if (coupon.userUsageLimit) {
            const userOrders = await Order.find({
                userId,
                "couponDetails.couponId": coupon._id,
            });

            if (userOrders.length >= coupon.userUsageLimit) {
                return res.status(400).json({
                    success: false,
                    message: "You have already used this coupon",
                });
            }
        }

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }

        if (coupon.minOrderValue && coupon.minOrderValue > cart.finalAmount) {
            return res.status(400).json({
                success: false,
                message: "Minimum purchase amount not met",
            });
        }

        // Calculate discount
        const cartTotal = cart.finalAmount;
        let discountAmount = 0;

        if (coupon.discountType === "percentage") {
            discountAmount = (cartTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountValue) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscountValue);
            }
        } else {
            discountAmount = coupon.discountValue;
        }

        discountAmount = Math.min(discountAmount, cartTotal); // Ensure discount does not exceed cart total
        const shippingFee = 10;
        const totalAmount = cartTotal + shippingFee - discountAmount;

        // Store coupon details in session
        req.session.coupon = {
            couponId: coupon._id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount,
            totalAmount,
            appliedAt: new Date(),
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => (err ? reject(err) : resolve()));
        });

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

//place order by wallet
const placeOrderByWallet = async (req, res) => {
    try {
        //function to generate transid for wallet transaction
        async function generateUniqueTransactionId() {
            let isUnique = false;
            let transactionId;

            while (!isUnique) {
                const timestamp = Date.now().toString(); // Current timestamp
                const randomString = crypto.randomBytes(4).toString("hex"); // Random alphanumeric string
                transactionId = `TXN-${timestamp}-${randomString}`; // Combine with a prefix

                // Check if the transaction ID exists in the wallet collection
                const existingTransaction = await Wallet.findOne({ "transactions.transactionId": transactionId });
                if (!existingTransaction) {
                    isUnique = true; // Exit the loop if no document contains this transaction ID
                }
            }

            return transactionId;
        }

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

        //fetch wallet and check balance

        const wallet = await Wallet.findOne({ userId: userId });

        if (!wallet) {
            return res.status(400).json({ success: false, message: "Wallet not found." });
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

                if (coupon.maxDiscountValue > 0) {
                    discountAmount = Math.min(discountAmount, coupon.maxDiscountValue);
                }
            } else {
                discountAmount = coupon.discountValue;
            }

            // Ensure discount doesn't exceed cart total
            let shippingFee = 10;

            discountAmount = Math.min(discountAmount, cartTotal);

            const totalPrice = cartTotal - discountAmount + shippingFee;
            if (wallet.balance < totalPrice) {
                return res.status(400).json({ success: false, message: "Insufficient Balance in wallet" });
            }

            console.log("total price while placing order is", totalPrice);

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

            //calculate total items

            const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

            const uniqueId = await generateOrderId();

            // Prepare order data
            const address = { userId, addressType, fullName, phone, altPhone, state, city, landmark, pincode };
            let order;

            order = new Order({
                userId,
                paymentType: paymentMethod,
                shippingFee,
                totalItems,
                totalPrice: totalPrice,
                address,
                orderNotes,
                paymentStatus: "Success",
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

            //deduct the amount from the wallet;

            const transId = await generateUniqueTransactionId();
            wallet.balance = wallet.balance - totalPrice;

            wallet.transactions.push({
                transactionId: transId.toString(),
                type: "Debit",
                amount: totalPrice,
                description: "Purchase",
            });

            await wallet.save();

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

            if (wallet.balance < totalPrice) {
                return res.status(400).json({ success: false, message: "Insufficient Balance in wallet" });
            }

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
            //total items
            const totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
            // Prepare order data
            const address = { userId, addressType, fullName, phone, altPhone, state, city, landmark, pincode };

            const order = new Order({
                userId,
                paymentType: paymentMethod,
                shippingFee,
                totalPrice,
                totalItems,
                address,
                orderNotes,
                items: cart.items,
                orderId: uniqueId,
            });

            // Save the order and delete the cart

            const savedOrder = await order.save();

            //deduct the amount from the wallet;

            const transId = await generateUniqueTransactionId();
            wallet.balance = wallet.balance - totalPrice;

            wallet.transactions.push({
                transactionId: transId.toString(),
                type: "Debit",
                amount: totalPrice,
                description: "Purchase",
            });

            await wallet.save();

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
module.exports = { loadCheckout, placeOrder, rzpCreateOrder, rzpVerifyPayment, applyCoupon, placeOrderByWallet };
