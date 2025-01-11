const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },
        orderId: {
            type: String,
            unique: true,
            required: true,
        },
        items: [
            {
                productId: {
                    type: Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 1,
                    min: 1,
                    max: 5,
                },
                price: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                size: {
                    type: String,
                    required: true,
                },
                status: {
                    type: String,
                    enum: ["Active", "Cancelled", "Return Pending", "Return Approved", "Return Rejected", "Returned"],
                    default: "Active",
                    required: true,
                },
                returnRequest: {
                    status: {
                        type: String,
                        enum: ["No Request", "Pending", "Approved", "Rejected"],
                        default: "No Request",
                    },
                    requestDate: Date,
                    reason: String,
                    details: String,
                    adminResponse: {
                        status: String,
                        responseDate: Date,
                        note: String,
                    },
                },
            },
        ],
        totalItems: {
            type: Number,
            required: true,
        },
        paymentType: { type: String, enum: ["COD", "Online", "Wallet"], default: "COD" },
        paymentStatus: {
            type: String,
            enum: ["Failed", "Not Paid","Processing", "Success"],
            default: "Processing",
        },
        paymentDetails: {
            paymentId: { type: String },
            orderId: { type: String },
            status: { type: String },
            paymentMethod: { type: String },
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        invoiceDate: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            required: true,
            enum: [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered",
                "Cancelled",
                "Return Request",
                "Return Request Approved",
                "Return Request Rejected",
                "Returned",
            ],
            default: "Pending",
        },
        couponApplied: {
            type: Boolean,
            default: false,
        },
        couponDetails: {
            couponId: {
                type: Schema.Types.ObjectId,
                ref: "Coupon",
                required: false,
            },
            couponName: {
                type: String,
                required: false,
            },
            discountAmount: {
                type: Number,
                required: false,
            },
            percentage: {
                type: Number,
                required: false,
            },
            discountType: {
                type: String,
                required: false,
            },
        },
        shippingFee: {
            type: Number,
            default: 0,
            min: 0,
        },
        orderNote: {
            type: String,
            maxlength: 500,
        },

        returnRequest: {
            status: {
                type: String,
                enum: ["No Request", "Pending", "Approved", "Rejected"],
                default: "No Request",
            },
            requestDate: Date,
            reason: {
                type: String,
                required: function () {
                    return this.returnRequest.status !== "No Request";
                },
            },
            adminResponse: {
                status: String,
                responseDate: Date,
                note: String,
            },
        },

        address: {
            addressType: {
                type: String,
                enum: ["Home", "Work", "Other"],
                required: true,
                default: "Home",
            },
            userId: {
                required: true,
                type: Schema.Types.ObjectId,
                ref: "User",
            },
            fullName: {
                type: String,
                required: true,
                maxlength: 100,
            },
            city: {
                type: String,
                required: true,
                maxlength: 100,
            },
            landMark: {
                type: String,
                maxlength: 100,
            },
            state: {
                type: String,
                required: true,
                enum: [
                    "Andhra Pradesh",
                    "Arunachal Pradesh",
                    "Assam",
                    "Bihar",
                    "Chhattisgarh",
                    "Goa",
                    "Gujarat",
                    "Haryana",
                    "Himachal Pradesh",
                    "Jharkhand",
                    "Karnataka",
                    "Kerala",
                    "Madhya Pradesh",
                    "Maharashtra",
                    "Manipur",
                    "Meghalaya",
                    "Mizoram",
                    "Nagaland",
                    "Odisha",
                    "Punjab",
                    "Rajasthan",
                    "Sikkim",
                    "Tamil Nadu",
                    "Telangana",
                    "Tripura",
                    "Uttar Pradesh",
                ],
            },
            pincode: {
                type: Number,
                required: true,
            },
            phone: {
                type: String,
                required: true,
                validate: {
                    validator: (value) => /^[0-9]{10}$/.test(value),
                    message: "Phone number must be 10 digits",
                },
            },
            altPhone: {
                type: String,
                validate: {
                    validator: (value) => !value || /^[0-9]{10}$/.test(value),
                    message: "Alternate Phone Number must be 10 digits",
                },
            },
        },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
