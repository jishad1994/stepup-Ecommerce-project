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
            },
        ],
        totalPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        finalAmount: {
            type: Number,
            validate: {
                validator: function (value) {
                    return value >= 0 && value === this.totalPrice;
                },
                message: "Final amount must equal the total price.",
            },
        },
        status: {
            type: String,
            enum: ["Placed", "Cancelled", "Returned"],
            default: "Placed",
        },
        cancellationReason: {
            type: String,
            default: "none",
            validate: {
                validator: function (value) {
                    return this.status === "Cancelled" ? value.trim().length > 0 : value === "none";
                },
                message: "Cancellation reason is required when the status is 'Cancelled'.",
            },
        },
        currency: {
            type: String,
            default: "USD",
        },
    },
    { timestamps: true }
);

cartSchema.pre("save", function (next) {
    // Recalculate the total price and final amount before saving
    this.totalPrice = this.items.reduce((total, item) => {
        return total + item.quantity * item.price;
    }, 0);
    this.finalAmount = this.totalPrice;

    // Reset cancellation reason if status is not "Cancelled"
    if (this.status !== "Cancelled") {
        this.cancellationReason = "none";
    }
    next();
});

module.exports = mongoose.model("Cart", cartSchema);
