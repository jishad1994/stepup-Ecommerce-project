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
        //update the status of each item
        await Promise.all(
            order.items.map(async (item) => {
                item.status = "Cancelled";
            })
        );

        // Refund if payment was via Wallet or Online
        if (["Online", "Wallet", "card", "netbanking", "wallet", "upi", "emi"].includes(order.paymentType)) {
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

            order.paymentStatus = "Refunded";
        }

        await order.save();

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
        return res.status(500).json({ success: false, message: "internal server error" });
    }
};

//cancel single item
const cancelSingleItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.query;

        if (!orderId || !itemId || !mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ success: false, message: "Invalid Order ID or Item ID." });
        }

        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
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

        const wallet = await Wallet.findOne({ userId });

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order." });
        }

        // Cancel the item
        item.status = "Cancelled";

        const activeItems = order.items.filter((item) => item.status !== "Cancelled");
        order.totalItems = activeItems.reduce((total, item) => total + item.quantity, 0);

        let subtotal = activeItems.reduce((total, item) => total + item.price * item.quantity, 0);

        // Handle coupon
        if (order.couponApplied && order.couponDetails) {
            const coupon = await Coupon.findOne({ code: order.couponDetails.couponName });
            if (coupon && subtotal >= coupon.minOrderValue) {
                const { discountType, discountValue, maxDiscountValue } = coupon;
                let discountAmount = 0;

                if (discountType === "percentage") {
                    discountAmount = Math.min((subtotal * discountValue) / 100, maxDiscountValue || Infinity);
                } else if (discountType === "flat") {
                    discountAmount = discountValue;
                }

                order.couponDetails.discountAmount = discountAmount;
                subtotal -= discountAmount;
            } else {
                order.couponApplied = false;
                order.couponDetails = null;
            }
        }

        subtotal += order.shippingFee || 0;
        const refundAmount = order.totalPrice - Math.max(0, subtotal);

        if (
            ["Online", "Wallet", "card", "netbanking", "wallet", "upi", "emi"].includes(order.paymentType) &&
            refundAmount > 0
        ) {
            const transactionId = await generateUniqueTransactionId();
            wallet.balance += refundAmount;
            wallet.transactions.push({
                transactionId,
                type: "Credit",
                amount: refundAmount,
                description: "Item cancellation refund",
            });
            await wallet.save();
        }

        order.totalPrice = Math.max(0, subtotal);

        if (activeItems.length === 0) {
            order.status = "Cancelled";
            order.couponApplied = false;
            order.couponDetails = null;
        }

        const product = await Product.findById(item.productId);
        if (product) {
            product.purchaseCount = Math.max(0, product.purchaseCount - item.quantity);

            const stockItem = product.stock.find((stock) => stock.size === item.size);
            if (stockItem) {
                stockItem.quantity += item.quantity;
            }
            await product.save();
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

//return order
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

//load success page
const loadSuccessPage = async (req, res) => {
    try {
        const { _id } = req.params;

        if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
            console.log(`Invalid or missing order ID: ${_id}`);
            return res
                .status(400)
                .json({ success: false, message: "Invalid or missing order ID in the request parameters" });
        }

        const order = await Order.findById(_id);

        if (!order) {
            console.log(`Order not found for ID: ${_id}`);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check user authorization (if applicable)
        if (order.userId.toString() !== req.user._id.toString()) {
            console.log(`Unauthorized access to order: ${_id}`);
            return res.status(403).json({ success: false, message: "Unauthorized access to the order" });
        }

        res.render("successPage", { order });
    } catch (error) {
        console.error(`Error while loading success page for order ID: ${req.params._id}`, error);
        res.status(500).json({ success: false, message: "Internal Server Error while loading the success page" });
    }
};

module.exports = {
    loadOrders,
    cancelOrder,
    showDetails,
    cancelSingleItem,
    returnOrder,
    returnItem,
    loadSuccessPage,
};
