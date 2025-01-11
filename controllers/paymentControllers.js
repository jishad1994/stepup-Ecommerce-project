const mongoose = require("mongoose");
const env = require("dotenv").config();
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Order = require("../model/orderModel.js");
const Wallet = require("../model/walletModel.js");
const Cart = require("../model/cartSchema.js");
const Coupon = require("../model/couponSchema.js");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");

//create azorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET,
});

//repayment after failure
const reTryRzpCreateOrder = async function (req, res) {
    try {
        const userId = req.user._id;
        const { _id, currency } = req.body;

        if (!_id) {
            console.log("order object id not found");
            return res.status(400).json({ success: false, message: "Invalid order object id" });
        }

        //find the order using id
        const userOrder = await Order.findById(_id);

        if (!userOrder) {
            console.log("order  not found");
            return res.status(400).json({ success: false, message: "Order Not found" });
        }

        const orderId = userOrder.orderId;
        if (!orderId) {
            console.log("order id not found");
            return res.status(400).json({ success: false, message: "OrderId Not found" });
        }

        //total amount to be paid
        const amount = userOrder.totalPrice;

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

        // Create the Razorpay order
        const order = await razorpay.orders.create(options);
        console.log("order data recieved while creating rzp order is", order);

        // Send response
        return res.status(200).json({
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

//repayment order verfication
//razorpay checkout controller
const reTryRzpVerifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, _id } = req.body;

        console.log(req.body);
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

module.exports = {
    reTryRzpCreateOrder,
    reTryRzpVerifyPayment,
};
