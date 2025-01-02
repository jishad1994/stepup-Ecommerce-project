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
            console.log("No ID found in params");
            return res.status(400).json({ success: false, message: "No ID in params" });
        }

        // Find the order
        const order = await Order.findOne({ _id: id });

        if (!order) {
            console.log("No order found");
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check the status of the order
        const orderStatus = order.status;

        // Only cancel the order if it is either "Pending" or "Processing"
        if (orderStatus === "Pending" || orderStatus === "Processing") {
            order.status = "Cancelled";
            await order.save();

            //update the product stock and product purchase count if order placement sucesfull

            const productIds = order.items.map((item) => item.productId);

            const productsToUpdate = await Product.find({ _id: { $in: productIds } });
            const updatedProducts = [];
            order.items.map((item) => {
                const product = productsToUpdate.find((p) => p._id.equals(item.productId));
                //decrease the purchase count
                product.purchaseCount -= item.quantity;

                //adjust quantity of the specific size
                product.stock.map((stockItem, index) => {
                    if (stockItem.size == item.size) {
                        product.stock[index].quantity += item.quantity;
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

            console.log("Order cancellation successful");
            return res.status(200).json({ success: true, message: "Order cancellation successful" });
        } else {
            console.log("Order cannot be cancelled");
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is already ${orderStatus}`,
            });
        }
    } catch (error) {
        console.error("Internal server error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

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

        //find the prodcuts to display images
        // Fetch the products
        const products = await Product.find({ _id: { $in: productIds } });

        //
        if (productIds.length === 0) {
            console.log("No products found in the order");
            return res.render("orderDetails", { order, products: [] });
        }

        //render page
        res.render("orderDetails", { order, products });
    } catch (error) {
        console.log("internal server error");
        return res.status(500).json({ success: false, message: "inteernal server error" });
    }
};

const cancelSingleItem = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        const itemId = req.query.itemId;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (!["Pending", "Processing"].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel items from orders that are not Pending or Processing",
            });
        }

        // Find and update the specific item
        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in order" });
        }

        // Set item status to cancelled
        item.status = "Cancelled";

        // Recalculate order totals (this will handle coupon calculations)

        // Get active items only
        const activeItems = order.items.filter((item) => item.status === "Active");

        // Calculate base total from active items
        let subtotal = activeItems.reduce((total, item) => {
            return total + item.price * item.quantity;
        }, 0);

        // Calculate total items
        this.totalItems = activeItems.reduce((total, item) => {
            return total + item.quantity;
        }, 0);

        // Apply coupon if exists
        if (order.couponApplied && order.couponDetails) {
            if (order.couponDetails.discountType === "percentage" && order.couponDetails.percentage) {
                const discountAmount = (subtotal * order.couponDetails.percentage) / 100;
                order.couponDetails.discountAmount = discountAmount;
                subtotal -= discountAmount;
            } else if (order.couponDetails.discountType === "flat" && order.couponDetails.discountAmount) {
                subtotal -= order.couponDetails.discountAmount;
            }
        }

        // Add shipping fee
        subtotal += this.shippingFee;

        // Set final total price
        order.totalPrice = Math.max(0, subtotal); // Ensure price doesn't go below 0

        // If all items are cancelled, cancel the entire order
        if (activeItems.length === 0) {
            order.status = "Cancelled";
            // Reset coupon details since order is cancelled
            order.couponApplied = false;
            order.couponDetails = undefined;
        }

        await order.save();

        res.json({
            success: true,
            message: "Item cancelled successfully",
            updatedTotals: {
                totalItems: order.totalItems,
                totalPrice: order.totalPrice,
                discountAmount: order.couponDetails?.discountAmount || 0,
            },
        });
    } catch (error) {
        console.error("Error cancelling item:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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
