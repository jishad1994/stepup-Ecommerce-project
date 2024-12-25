const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
    {
        name: {
            type: Number,
            required: [true, "Size is required"],
            unique: true,
            min: [1, "Size must be at least 1"],
            max: [50, "Size must be 50 or less"],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Size", sizeSchema);
