const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        expireOn: {
            type: Date,
            required: true,
        },
        offerprice: {
            type: Number,
            required: true,
        },
        minimumPrice: {
            type: Number,
            required: true,
        },
        isListed: {
            type: Boolean,
            default: true,
        },
        userId:[{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }]
    },
    { timestamps: true }
);
const Coupon = mongoose.model("Coupon",couponSchema)
module.exports = Coupon;
