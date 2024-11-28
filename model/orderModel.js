const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema(
    {
        orderId: {
            type: String,
            default: () => uuidv4(),
            unique: true,
        },
        orderItems: [
            {
                product: {
                    type: Schema.Types.ObjectId,
                    ref: "Product",
                    require: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                price: {
                    type: Number,
                    default: 0,
                    required: true,
                },
            },
        ],

        totalprice: {
            type: Number,
            required: true,
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
        },
        finalAmount: {
            type: Number,
            required: true,
        },
        address: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        invoiceDate: {
            type: Date,
        },
        status: {
            type: String,
            required: true,
            enum: ["Pending", "processing", "Shipped", "Delivered", "cancelled", "return Request", "Returned"],
            default: "Pending",
        },
        couponApplied: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
