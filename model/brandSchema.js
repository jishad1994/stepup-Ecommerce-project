const mongoose = require("mongoose");
const { Schema } = mongoose;

const brandSchema = new Schema(
    {
        name: {
            type: String,
            unique: true,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const brandModel = mongoose.model("Brand", brandSchema);
module.exports = brandModel;
