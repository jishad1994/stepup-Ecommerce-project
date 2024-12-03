const mongoose = require("mongoose");
const { Schema } = mongoose;

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        description: {
            type: String,
            required: true,
        },
        isListed: {
            type: Boolean,
            required:false,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            required: false,
            default: false,
        },
        categoryOffer: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
