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
const HTTP_STATUS = require("../constants/status-codes.constants.js");
const MESSAGES = require("../constants/http-messages.constants.js");

////
//add address
const addAddress = async (req, res) => {
    try {
        // Ensure the email is available
        const email = req.user?.email;
        if (!email) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.REQUIRED,
            });
        }

        // Fetch user from the database
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.AUTH.USER_NOT_FOUND,
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
        
        // Comprehensive validation
        const validationErrors = [];

        // Full Name validation
        if (!fullName || !/^[a-zA-Z\s'-]{3,50}$/.test(fullName)) {
            validationErrors.push(MESSAGES.VALIDATION.INVALID_FULL_NAME);
        }

        // Phone number validations
        if (!phone || !/^\d{10}$/.test(phone)) {
            validationErrors.push(MESSAGES.VALIDATION.INVALID_PHONE);
        }

        // City validation
        if (!city || !/^[a-zA-Z\s]{3,}$/.test(city)) {
            validationErrors.push(MESSAGES.VALIDATION.INVALID_CITY);
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
            validationErrors.push(MESSAGES.VALIDATION.INVALID_STATE);
        }

        // Pincode validation
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            validationErrors.push(MESSAGES.VALIDATION.INVALID_PINCODE);
        }

        // Check for validation errors
        if (validationErrors.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.ADDRESS.VALIDATION_FAILED,
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
            altPhone: altphone,
            city,
            state,
            pincode,
            landMark: landmark,
            addressDetails,
            isDefault,
            userId,
        });

        await address.save();

    
      

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: MESSAGES.ADDRESS.ADD_SUCCESS,
            addressId: address._id,
        });
    } catch (error) {
        console.error("Error while adding address:", error);

        // Differentiate between validation and server errors
        if (error.name === "ValidationError") {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.ADDRESS.VALIDATION_ERROR,
                errors: Object.values(error.errors).map((err) => err.message),
            });
        }

        // Generic server error
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.ADDRESS.ADD_ERROR,
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
            const message = MESSAGES.ADDRESS.NO_ADDRESSES;
          
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
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.ADDRESS.DELETE_ID_MISSING,
            });
        }

        // Attempt to delete the address
        const deletedAddress = await Address.findByIdAndDelete(id);

        // Check if address was actually deleted
        if (!deletedAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.ADDRESS.NOT_FOUND,
            });
        }

        // Successful deletion
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.ADDRESS.DELETE_SUCCESS,
            deletedAddress,
        });
    } catch (error) {
        console.error("Error while deleting address:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SERVER_ERROR + " while deleting address",
        });
    }
};

// post edit address

const postEditAddress = async (req, res) => {
    try {
        // Check if _id is present in the request
        if (!req.params.id) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.ADDRESS.ID_REQUIRED,
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
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                message: MESSAGES.ADDRESS.UPDATE_SUCCESS,
            });
        } else {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.ADDRESS.UPDATE_NO_CHANGE,
            });
        }
    } catch (error) {
        console.error("Error while updating address:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SERVER_ERROR + " while updating address",
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
            return res.status(HTTP_STATUS.NOT_FOUND).render("error", {
                message: MESSAGES.ADDRESS.NOT_FOUND,
            });
        }

        // Render edit address page with address details
        res.render("editAddress", {
            address,
        });
    } catch (error) {
        console.error("Error while loading edit address:", error);

        // Send a proper error response
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error", {
            message: MESSAGES.ADDRESS.LOAD_EDIT_ERROR,
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