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
        usedCount: {
            type: Number,
            default: 0, // Initialize to 0.
            validate: {
                validator: function (value) {
                    return this.usageLimit === null || value <= this.usageLimit;
                },
                message: "Used count cannot exceed usage limit.",
            },
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
            validate: {
                validator: function (value) {
                    return value > this.startDate;
                },
                message: "End date must be after start date.",
            },
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

// Virtual to determine active status based on date
couponSchema.virtual("isCurrentlyActive").get(function () {
    const now = new Date();
    return this.isActive && now >= this.startDate && now <= this.endDate;
});

// Pre-save middleware for validations
couponSchema.pre("save", function (next) {
    if (this.usageLimit && this.usedCount > this.usageLimit) {
        return next(new Error("Used count cannot exceed usage limit."));
    }
    next();
});

module.exports = mongoose.model("Coupon", couponSchema);
