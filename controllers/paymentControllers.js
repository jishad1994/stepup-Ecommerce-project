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

const HTTP_STATUS = require("../constants/status-codes.constants.js");
const MESSAGES = require("../constants/http-messages.constants.js");
const { PAYMENT_STATUS, PAYMENT_METHOD } = require("../constants/order-status.constants.js");

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
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.PAYMENT.INVALID_ORDER_OBJECT_ID });
        }

        //find the order using id
        const userOrder = await Order.findById(_id);

        if (!userOrder) {
            console.log("order  not found");
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.PAYMENT.ORDER_NOT_FOUND });
        }

        const orderId = userOrder.orderId;
        if (!orderId) {
            console.log("order id not found");
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.PAYMENT.ORDER_ID_NOT_FOUND });
        }

        //total amount to be paid
        const amount = userOrder.totalPrice;

        // Determine the amount to be charged

        if (!amount || isNaN(amount) || amount <= 0) {
            console.log("invalid amount provided");
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.PAYMENT.INVALID_AMOUNT });
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
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            rzp_key: process.env.RZP_KEY_ID,
        });
    } catch (error) {
        console.error("Error creating Razorpay order for user:", req.user._id, error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: MESSAGES.PAYMENT.CREATE_ORDER_FAILED });
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
                paymentStatus: PAYMENT_STATUS.SUCCESS,
                paymentDetails: {
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                    status: PAYMENT_STATUS.SUCCESS,
                    paymentMethod: PAYMENT_METHOD.RAZORPAY,
                },
            });

            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: MESSAGES.PAYMENT.VERIFY_SUCCESS,
                razorpay_order_id,
                razorpay_payment_id,
            });
        } else {
            // Signature mismatch — payment could not be verified
            await Order.findByIdAndUpdate(_id, {
                paymentStatus: PAYMENT_STATUS.FAILED,
            });

            res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.PAYMENT.VERIFY_FAILED });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.PAYMENT.VERIFY_ERROR,
        });
    }
};

module.exports = {
    reTryRzpCreateOrder,
    reTryRzpVerifyPayment,
};