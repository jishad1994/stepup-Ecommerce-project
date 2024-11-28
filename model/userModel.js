const mongoose = require("mongoose");
const { Schema } = mongoose;
const userSchema = new Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null,
    },
    password: {
        type: String,
        required: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    isBlocked: {
        type: Boolean,
        default: false,
        required: false,
    },
    isAdmin: {
        type: Boolean,
        required: false,
        default: false,
    },
    cart: [
        {
            type: Schema.Types.ObjectId,
            ref: "Cart",
        },
    ],
    wallet: [
        {
            type: Schema.Types.ObjectId,
            ref: "Wallet",
        },
    ],
    orderhistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Order",
        },
    ],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    redeemed: {
        type: Boolean,
        default: false,
    },
    redeemedUsers: [
        {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    searchHistory: [
        {
            category: {
                type: Schema.Types.ObjectId,
                ref: "Category",
            },
            brand: {
                type: String,
            },
            searchOn: {
                type: Date,
                default: Date.now,
            },
        },
    ],
});

module.exports = mongoose.model("user", userSchema);