const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    addressType: {
        type: String,
        enum: ["Home", "Work", "Other"],
        required: true,
        default: "Home",
    },
    userId: {
        required: true,
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    fullName: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    landMark: {
        type: String,
        required: false,
    },
    state: {
        type: String,
        required: true,
        enum: [
            "Andhra Pradesh",
            "Arunachal Pradesh",
            "Assam",
            "Bihar",
            "Chhattisgarh",
            "Goa",
            "Gujarat",
            "Haryana",
            "Himachal Pradesh",
            "Jharkhand",
            "Karnataka",
            "Kerala",
            "Madhya Pradesh",
            "Maharashtra",
            "Manipur",
            "Meghalaya",
            "Mizoram",
            "Nagaland",
            "Odisha",
            "Punjab",
            "Rajasthan",
            "Sikkim",
            "Tamil Nadu",
            "Telangana",
            "Tripura",
            "Uttar Pradesh",
        ],
    },
    pincode: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: true,
        validate: {
            validator: (value) => /^[0-9]{10}$/.test(value),
            message: "Phone number must be 10 digits",
        },
    },
    altPhone: {
        type: String,
        required: false,
        validate: {
            validator: (value) => !value || /^[0-9]{10}$/.test(value),
            message: "Alternate Phone Number must be 10 digits",
        },
    },
    addressDetails: {
        type: String,
        required: false,
    },
    isDefault: {
        type: Boolean,
        required: false,
        default: false,
    },
},{timestamps:true});

module.exports = mongoose.model("Address", addressSchema);
