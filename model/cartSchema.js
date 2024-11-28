const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
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
                    default: 1,
                    min: 1,
                },
                price: { // Price specific to the product
                    type: Number,
                    required: true,
                    min: 0,
                },
            },
        ],
        totalPrice: { // Calculated total price for all items
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ["Placed", "Cancelled", "Returned"],
            default: "Placed",
        },
        cancellationReason: {
            type: String,
            default: "none",
        },
    },
    { timestamps: true }
);

cartSchema.pre("save", function (next) {
    // Recalculate the total price before saving
    this.totalPrice = this.items.reduce((total, item) => {
        return total + item.quantity * item.price;
    }, 0);
    next();
});

module.exports = mongoose.model("Cart", cartSchema);
