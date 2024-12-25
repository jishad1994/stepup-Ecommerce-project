const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true, // Ensure coupon codes are stored in uppercase.
            trim: true,
        },
        discountType: {
            type: String,
            enum: ["percentage", "flat"], // 'percentage' for % discounts, 'flat' for fixed amount.
            required: true,
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0, // Ensure positive discount values.
        },
        minOrderValue: {
            type: Number,
            default: 0, // Minimum order value to apply the coupon.
        },
        maxDiscountValue: {
            type: Number,
            default: null, // Cap for percentage-based discounts.
        },
        applicableProducts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product", // Apply to specific products.
            },
        ],
        applicableCategories: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category", // Apply to specific categories.
            },
        ],
        usageLimit: {
            type: Number,
            default: null, // Number of times this coupon can be used in total.
        },
        userUsageLimit: {
            type: Number,
            default: 1, 
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true, 
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin", 
            required: false,
        },
    },
    {
        timestamps: true, // Automatically add `createdAt` and `updatedAt`.
    }
);

module.exports = mongoose.model("Coupon", couponSchema);
