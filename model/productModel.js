const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
    {
        productName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        brand: {
            type: Schema.Types.ObjectId,
            ref: "Brand", // Assuming you have a Brand model
            required: false,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        stock: [
            {
                size: {
                    type: String,
                    enum: ["6", "7", "8", "9"],
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 0,
                },
            },
        ],
        totalStock: {
            type: Number,
            required: true,
            default: 0, // Default value
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        regularPrice: {
            type: Number,
            required: true,
            min: [0, "Price cannot be negative"],
        },
        salePrice: {
            type: Number,
            required: true,
            min: [0, "Price cannot be negative"],
        },
        isOfferApplied: {
            type: Boolean,
            default: false,
        },
        productOffer: {
            type: Number,
            default: 0,
            min: [0, "Offer percentage cannot be negative"],
            max: [100, "Offer cannot exceed 100%"],
        },
        offerPrice: {
            type: Number,
            default: 0,
        },
        color: {
            type: String,
            required: false,
        },
        productImage: {
            type: [String],
            required: true,
        },
        status: {
            type: String,
            enum: ["Available", "Out of Stock", "Discontinued"],
            required: true,
            default: "Available",
        },
        isListed: {
            type: Boolean,
            default: true,
            required: false,
        },
        purchaseCount: {
            type: Number,
            default: 0,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        ratings: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                rating: {
                    type: Number,
                    required: true,
                    min: 1,
                    max: 5,
                },
                review: String,
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Method to apply a product offer
productSchema.methods.applyProductOffer = function (offerPercentage) {
    if (offerPercentage < 0 || offerPercentage > 100) {
        throw new Error("Offer percentage must be between 0 and 100.");
    }
    this.productOffer = offerPercentage;
    this.isOfferApplied = offerPercentage > 0;

    if (this.isOfferApplied) {
        this.offerPrice = this.salePrice * (1 - offerPercentage / 100);
    } else {
        this.offerPrice = 0;
    }
    return this.offerPrice;
};

// Method to update total stock and status
productSchema.methods.updateTotalStockAndStatus = function () {
    this.totalStock = this.stock.reduce((total, item) => total + item.quantity, 0);
    this.status = this.totalStock > 0 ? "Available" : "Out of Stock";
};

productSchema.pre("save", function (next) {
    // Ensure sale price is not higher than regular price
    if (this.salePrice > this.regularPrice) {
        this.salePrice = this.regularPrice;
    }
    // Update stock-related fields
    this.updateTotalStockAndStatus();

    // Calculate average rating
    if (this.ratings && this.ratings.length > 0) {
        const totalRating = this.ratings.reduce((sum, item) => sum + item.rating, 0);
        this.averageRating = totalRating / this.ratings.length;
    }

    // Ensure offerPrice is set correctly
    if (!this.isOfferApplied) {
        this.offerPrice = 0;
    }

    next();
});

module.exports = mongoose.model("Product", productSchema);
