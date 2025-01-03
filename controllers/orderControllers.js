const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const env = require("dotenv").config();
const jwt = require("jsonwebtoken");

//models
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Order = require("../model/orderModel.js");
const Wallet = require("../model/walletModel.js");
const Cart = require("../model/cartSchema.js");
const Coupon = require("../model/couponSchema.js");
const crypto = require("crypto");

//load order history page

const loadOrders = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!userId) {
            console.log("no user found ");
            return res.render("orders", { orders: [] });
        }
        //fetch the user

        const user = await User.findOne({ _id: userId });
        if (!user) {
            console.log("no user found ");
            return res.render("orders", { orders: [] });
        }

        //fetch the orders of customer

        const orders = await Order.find({ userId }).sort({ createdAt: -1 });

        if (!orders) {
            console.log("no orders found ");
            return res.render("orders", { orders: [] });
        }

        res.render("orders", { orders });
    } catch (error) {
        console.log("error while loading orders page");
        res.status(500).json({ success: false, message: "internal server error" });
    }
};

//cancell order
const cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: "Order ID is required." });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (!["Pending", "Processing"].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is already ${order.status}.`,
            });
        }

        // Cancel the order
        order.status = "Cancelled";
        await order.save();

        // Refund if payment was via Wallet or Online
        if (["Wallet", "Online"].includes(order.paymentType)) {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "User authentication required." });
            }

            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                return res.status(404).json({ success: false, message: "Wallet not found." });
            }

            wallet.balance += order.totalPrice;

            const transactionId = await generateUniqueTransactionId();
            wallet.transactions.push({
                transactionId,
                type: "Credit",
                amount: order.totalPrice,
                description: "Order Cancellation Refund",
            });

            await wallet.save();
        }

        // Update product stock and purchase count
        const productUpdates = order.items.map((item) => ({
            updateOne: {
                filter: { _id: item.productId, "stock.size": item.size },
                update: {
                    $inc: {
                        "stock.$.quantity": item.quantity,
                        purchaseCount: -item.quantity,
                    },
                },
            },
        }));

        await Product.bulkWrite(productUpdates);

        // Recalculate `totalStock` and `status`
        const products = await Product.find({ _id: { $in: order.items.map((item) => item.productId) } });

        await Promise.all(
            products.map((product) => {
                product.totalStock = product.stock.reduce((sum, sizeItem) => sum + sizeItem.quantity, 0);
                product.status = product.totalStock > 0 ? "Available" : "Out of Stock";
                return product.save();
            })
        );

        return res.status(200).json({ success: true, message: "Order cancellation successful." });
    } catch (error) {
        console.error("Error in cancelOrder:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Helper function to generate a unique transaction ID
async function generateUniqueTransactionId() {
    let transactionId;
    do {
        const timestamp = Date.now().toString();
        const randomString = crypto.randomBytes(4).toString("hex");
        transactionId = `TXN-${timestamp}-${randomString}`;

        const exists = await Wallet.findOne({ "transactions.transactionId": transactionId });
        if (!exists) break;
    } while (true);

    return transactionId;
}

//show order details

const showDetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            console.log("no params id found");
            return res.status(400).json({ success: false, message: "no id found" });
        }

        //find the order

        const order = await Order.findOne({ _id: id });
        if (!order) {
            console.log("no order found");
            return res.status(400).json({ success: false, message: "no order found" });
        }

        //fetch the product ids from order;
        const productIds = order.items.map((item) => item.productId);

        //
        if (productIds.length === 0) {
            console.log("No products found in the order");
            return res.render("orderDetails", { order, products: [] });
        }

        //find the prodcuts to display images
        // Fetch the products
        let products = await Product.find({ _id: { $in: productIds } });

        products = order.items.map((item) => {
            const product = products.find((product) => product._id.toString() === item.productId.toString());
            return product;
        });

        //render page
        res.render("orderDetails", { order, products });
    } catch (error) {
        console.log("internal server error");
        return res.status(500).json({ success: false, message: "inteernal server error" });
    }
};

//cancel single item
const cancelSingleItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.query;

        if (!orderId || !itemId) {
            return res.status(400).json({ success: false, message: "Order ID and Item ID are required." });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (!["Pending", "Processing"].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel items from orders that are not Pending or Processing.",
            });
        }

        // Find the item to cancel
        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order." });
        }

        // Update the item status to "Cancelled"
        item.status = "Cancelled";

        // Recalculate active items and order totals
        const activeItems = order.items.filter((item) => item.status !== "Cancelled");

        order.totalItems = activeItems.reduce((total, item) => total + item.quantity, 0);
        let subtotal = activeItems.reduce((total, item) => total + item.price * item.quantity, 0);

        // Handle coupon re-application
        if (order.couponApplied && order.couponDetails) {
            const coupon = await Coupon.findOne({ code: order.couponDetails.couponName });
            if (!coupon) {
                order.couponApplied = false;
                order.couponDetails = null;
            } else if (subtotal < coupon.minOrderValue) {
                // If subtotal is below the minimum order value, remove the coupon
                order.couponApplied = false;
                order.couponDetails = null;
            } else {
                // If the subtotal qualifies, recalculate the discount
                const { discountType, discountValue, maxDiscountValue } = coupon;

                let discountAmount = 0;
                if (discountType === "percentage") {
                    discountAmount = (subtotal * discountValue) / 100;
                    if (maxDiscountValue) {
                        discountAmount = Math.min(discountAmount, maxDiscountValue);
                    }
                } else if (discountType === "flat") {
                    discountAmount = discountValue;
                }

                order.couponDetails.discountAmount = discountAmount;
                subtotal -= discountAmount;
            }
        }

        // Add shipping fee
        subtotal += order.shippingFee || 0;

        // Ensure totalPrice does not go below 0
        order.totalPrice = Math.max(0, subtotal);

        // If all items are cancelled, cancel the entire order
        if (activeItems.length === 0) {
            order.status = "Cancelled";
            order.couponApplied = false;
            order.couponDetails = null;
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: "Item cancelled successfully.",
            updatedTotals: {
                totalItems: order.totalItems,
                totalPrice: order.totalPrice,
                discountAmount: order.couponDetails?.discountAmount || 0,
            },
        });
    } catch (error) {
        console.error("Error cancelling item:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const returnOrder = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        const { reason, details } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned",
            });
        }
        order.returnRequest = {
            status: "Pending",
            requestDate: new Date(),
            reason: `${reason}: ${details}`,
        };

        //change all status of products
        await Promise.all(
            order.items.map(async (item) => {
                item.status = "Return Pending";
                item.returnRequest.status = "Pending";
            })
        );

        //change order status as well
        order.status = "Return Request";

        await order.save();
        res.json({ success: true, message: "Return request submitted successfully" });

        console.log(orderId, reason, details);
    } catch (error) {
        console.error("Error submitting return request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const returnItem = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        const itemId = req.query.itemId;

        const { reason, details } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned",
            });
        }

        const item = order.items.find((item) => item._id.toString() === itemId);
        console.log("the returning item is ", item);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        item.returnRequest = {
            status: "Pending",
            requestDate: new Date(),
            reason,
            details,
        };

        item.status = "Return Pending";

        await order.save();

        res.json({ success: true, message: "Return request submitted successfully" });
    } catch (error) {
        console.error("Error submitting return request:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadOrders,
    cancelOrder,
    showDetails,
    cancelSingleItem,
    returnOrder,
    returnItem,
};
