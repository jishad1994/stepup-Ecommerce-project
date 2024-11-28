const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    addressType: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    landMark: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    pincode: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    altPhone: {
        type: String,
        required: false,
    },
});

module.exports = mongoose.model("Address".addressSchema);
 