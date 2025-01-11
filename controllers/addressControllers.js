const mongoose = require("mongoose");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();

////
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");

////
//add address
const addAddress = async (req, res) => {
    try {
        // Ensure the email is available
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in.",
            });
        }

        // Fetch user from the database
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found",
            });
        }

        const userId = user._id;

        // Extract and validate form data
        const {
            addressType,
            fullName,
            phone,
            altphone,
            city,
            state,
            pincode,
            landmark,
            addressDetails,
            isDefault,
        } = req.body;
        console.log(req.body);
        // Comprehensive validation
        const validationErrors = [];

        // Full Name validation
        if (!fullName || !/^[a-zA-Z\s'-]{3,50}$/.test(fullName)) {
            validationErrors.push("Invalid full name. Must be 3-50 characters.");
        }

        // Phone number validations
        if (!phone || !/^\d{10}$/.test(phone)) {
            validationErrors.push("Invalid primary phone number. Must be 10 digits.");
        }

        // City validation
        if (!city || !/^[a-zA-Z\s]{3,}$/.test(city)) {
            validationErrors.push("Invalid city name.");
        }

        // State validation
        const validStates = [
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
        ];
        if (!state || !validStates.includes(state)) {
            validationErrors.push("Invalid state selection.");
        }

        // Pincode validation
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            validationErrors.push("Invalid pincode. Must be 6 digits.");
        }

        // Check for validation errors
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors,
            });
        }

        //if isdefault is true change all other defaults to false

        if (isDefault == true) {
            await Address.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
        }

        // Create and save address in the database
        const address = new Address({
            addressType,
            fullName,
            phone,
            altPhone:altphone,
            city,
            state,
            pincode,
            landMark:landmark,
            addressDetails,
            isDefault,
            userId,
        });

        await address.save();
        
        console.log("new address saved");
        console.log(address);

        return res.status(201).json({
            success: true,
            message: "Address added successfully",
            addressId: address._id,
        });
    } catch (error) {
        console.error("Error while adding address:", error);

        // Differentiate between validation and server errors
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: Object.values(error.errors).map((err) => err.message),
            });
        }

        // Generic server error
        return res.status(500).json({
            success: false,
            message: "Internal server error. Unable to add address.",
        });
    }
};

// load addresses display

const addresses = async (req, res) => {
    try {
        //fetching email from rq object
        const email = req.user.email;

        //finding user from DB using email
        const user = await User.findOne({ email });

        //userId to fetch address objects from adress collection

        const addresses = await Address.find({ userId: user._id });

        if (addresses.length === 0) {
            const message = "No addresses to display..please add your address";
            console.log("No addresses to fetch from db");
            return res.render("addresses", { message });
        }
        res.render("addresses", { addresses, message: "" });
    } catch (error) {
        console.log("error while displeaying addresses page", error);
        res.render("404");
    }
};

//delete address
const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if id is provided
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Couldn't find the ID of the address",
            });
        }

        // Attempt to delete the address
        const deletedAddress = await Address.findByIdAndDelete(id);

        // Check if address was actually deleted
        if (!deletedAddress) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }

        // Successful deletion
        return res.status(200).json({
            success: true,
            message: "Address deleted successfully",
            deletedAddress,
        });
    } catch (error) {
        console.error("Error while deleting address:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while deleting address",
        });
    }
};

// post edit address

const postEditAddress = async (req, res) => {
    try {
        // Check if _id is present in the request
        if (!req.params.id) {
            return res.status(400).json({
                success: false,
                message: "Address ID is required",
            });
        }

        const { ...formData } = req.body;

        //if isdefault is true change all other defaults to false

        if (formData.isDefault == true) {
            await Address.updateMany({ isDefault: true }, { $set: { isDefault: false } });
        }

        const _id = new mongoose.Types.ObjectId(`${req.params.id}`);

        const response = await Address.updateOne({ _id }, { $set: { ...formData } });

        if (response.modifiedCount > 0) {
            return res.status(200).json({
                success: true,
                message: "Address updated successfully",
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "No address found or no changes made",
            });
        }
    } catch (error) {
        console.error("Error while updating address:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating address",
        });
    }
};

//load edit address
const loadEditAddress = async (req, res) => {
    try {
        // Use _id instead of addressId
        const addressId = req.params.id;

        // Find by _id, not addressId
        const address = await Address.findById(addressId);

        // Check if address exists
        if (!address) {
            return res.status(404).render("error", {
                message: "Address not found",
            });
        }

        // Render edit address page with address details
        res.render("editAddress", {
            address,
        });
    } catch (error) {
        console.error("Error while loading edit address:", error);

        // Send a proper error response
        res.status(500).render("error", {
            message: "An error occurred while loading the address",
            error: error.message,
        });
    }
};

//add address
const loadAddAddress = async (req, res) => {
    try {
        //pass the array of addresses to ejs
        res.render("addAddress");
    } catch (error) {
        console.log("error while rendering the add address page");
        res.render("404");
    }
};

module.exports = {
    addAddress,
    addresses,
    deleteAddress,
    postEditAddress,
    loadEditAddress,
    loadAddAddress,
};
