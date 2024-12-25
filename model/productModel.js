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
        productOffer: {
            type: Number,
            required: false,
            default: 0,
            min: [0, "Offer percentage cannot be negative"],
            max: [100, "Offer cannot exceed 100%"],
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
        methods: {
            calculateDiscountedPrice() {
                const discount = this.productOffer || 0;
                return this.salePrice * (1 - discount / 100);
            },
        },
    }
);

// Method to get total stock
function getTotalStock() {
    return this.stock.reduce((total, stockItem) => total + stockItem.quantity, 0);
}
//helper function
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

    next();
});

//cases of updation
productSchema.post(["findOneAndUpdate", "updateOne", "updateMany"], async function (result) {
    if (result) {
        const updatedProduct = await Product.findById(result._id);
        updatedProduct.updateTotalStockAndStatus();
        await updatedProduct.save();
    }
});

module.exports = mongoose.model("Product", productSchema);
