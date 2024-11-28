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
            type: String,
            required: true,
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
            default: 0,
            min: [0, "Offer percentage cannot be negative"],
            max: [100, "Offer cannot exceed 100%"],
        },
        quantity: {
            type: Number,
            default: 0,
            min: 0,
        },
        color: {
            type: String,
            required: true,
        },
        productImage: {
            type: [String],
            required: true,
        },
        status: {
            type: String,
            enum: ["Available", "out of stock", "Discontinued"],
            required: true,
            default: "Available",
        },
    },
    { timestamps: true }
);

productSchema.pre("save", function (next) {
    // Ensure sale price is not higher than regular price
    if (this.salePrice > this.regularPrice) {
        this.salePrice = this.regularPrice;

        console.log("sale price ios higher vthan regular price");
    }
    next();
});

module.exports = mongoose.model("Product", productSchema);
