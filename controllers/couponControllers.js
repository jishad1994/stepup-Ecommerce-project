const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Wishlist = require("../model/wishlistSchema.js");
const Cart = require("../model/cartSchema.js");
const Order = require("../model/orderModel.js");
const Coupon = require("../model/couponSchema.js");
const couponSchema = require("../model/couponSchema.js");
const mongoose = require("mongoose");

//load coupon page
const loadAddCoupon = async (req, res) => {
    try {
        res.render("addCoupon");
    } catch (error) {
        console.error("Error loading coupons adding page:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

//create coupon
const postAddCoupon = async (req, res) => {
    try {
        // Validate input
        const { isValid, errors } = validateCouponInput(req.body);
        if (!isValid) {
            return res.status(400).json({ success: false, errors });
        }

        // Check for existing coupon with same code
        const existingCoupon = await Coupon.findOne({
            code: req.body.code.toUpperCase(),
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                errors: { code: "Coupon code already exists" },
            });
        }

        // Prepare coupon data
        const couponData = {
            code: req.body.code.toUpperCase(),
            discountType: req.body.discountType,
            discountValue: req.body.discountValue,
            minOrderValue: req.body.minOrderValue || 0,
            maxDiscountValue: req.body.maxDiscountValue || null,
            applicableProducts: req.body.applicableProducts || [],
            applicableCategories: req.body.applicableCategories || [],
            usageLimit: req.body.usageLimit || null,
            userUsageLimit: req.body.userUsageLimit || 1,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate),
            isActive: req.body.isActive !== undefined ? req.body.isActive : true,
            // Assuming you have user data from authentication middleware
        };

        // Create new coupon
        const coupon = new Coupon(couponData);
        await coupon.save();

        // Send success response
        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            data: coupon,
        });
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// List Coupons
const listCoupons = async (req, res) => {
    try {
        //paging logic for how many data to fetch and display
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Get  coupons
        const coupons = await Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

        // Count total products based on filter
        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        res.render("coupons", {
            coupons,
            currentPage: page,
            totalPages,
            totalCoupons,
        });
    } catch (error) {
        console.error("Error while loading coupons page:", error.message);

        // Render an error page with a proper message
        res.status(500).render("error", {
            pageTitle: "Error",
            message: "Failed to load the coupons page.",
            error: error.message,
        });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { _id } = req.query;

        // Validate the presence of _id
        if (!_id) {
            return res.status(400).json({ success: false, message: "No coupon _id provided." });
        }

        // Optional: Validate if _id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon _id." });
        }

        // Attempt to delete the coupon
        const deletedCoupon = await Coupon.findOneAndDelete({ _id });

        // Check if the coupon existed and was deleted
        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: "Coupon not found." });
        }

        // Redirect after successful deletion
        return res.redirect("/admin/listCoupons");
    } catch (error) {
        console.error("Error while deleting coupon:", error.message);

        // Handle errors with a generic response or render an error page
        return res.status(500).json({ success: false, message: "internal server error " });
    }
};

//change changeCouponStatus
const changeCouponStatus = async (req, res) => {
    try {
        const { _id } = req.query;

        // Validate the presence of _id
        if (!_id) {
            return res.status(400).json({ success: false, message: "No coupon _id provided." });
        }

        // Optional: Validate if _id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon _id." });
        }

        // Find the coupon by _id
        const coupon = await Coupon.findById(_id);

        // Check if the coupon exists
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found." });
        }

        // Toggle the coupon's active status
        coupon.isActive = !coupon.isActive;

        // Save the updated coupon
        await coupon.save();

        // Redirect to the coupon listing page
        return res.redirect("/admin/listCoupons");
    } catch (error) {
        console.error("Error while changing coupon status:", error.message);

        // Handle errors by rendering an error page or returning a response
        return res
            .status(500)
            .json({ success: false, message: "An unexpected error occurred while updating the coupon status." });
    }
};

module.exports = {
    loadAddCoupon,
    postAddCoupon,
    listCoupons,
    deleteCoupon,
    changeCouponStatus,
};

// Validation helper functions
const validateCouponInput = (data) => {
    const errors = {};

    // Validate required fields
    if (!data.code || typeof data.code !== "string" || data.code.trim() === "") {
        errors.code = "Coupon code is required";
    } else if (!/^[A-Za-z@#*0-9]+$/.test(data.code)) {
        errors.code = "Coupon code must be alphanumeric";
    }

    if (!data.discountType || !["percentage", "flat"].includes(data.discountType)) {
        errors.discountType = "Valid discount type (percentage/flat) is required";
    }

    if (!data.discountValue || isNaN(data.discountValue) || data.discountValue <= 0) {
        errors.discountValue = "Valid discount value is required";
    } else if (data.discountType === "percentage" && data.discountValue > 100) {
        errors.discountValue = "Percentage discount cannot exceed 100%";
    }

    if (!data.startDate || !Date.parse(data.startDate)) {
        errors.startDate = "Valid start date is required";
    }

    if (!data.endDate || !Date.parse(data.endDate)) {
        errors.endDate = "Valid end date is required";
    }

    if (Date.parse(data.endDate) <= Date.parse(data.startDate)) {
        errors.endDate = "End date must be after start date";
    }

    // Validate numeric fields
    if (data.minOrderValue && (isNaN(data.minOrderValue) || data.minOrderValue < 0)) {
        errors.minOrderValue = "Minimum order value must be a positive number";
    }

    if (data.maxDiscountValue && (isNaN(data.maxDiscountValue) || data.maxDiscountValue < 0)) {
        errors.maxDiscountValue = "Maximum discount value must be a positive number";
    }

    if (data.usageLimit && (isNaN(data.usageLimit) || data.usageLimit < 1)) {
        errors.usageLimit = "Usage limit must be at least 1";
    }

    if (data.userUsageLimit && (isNaN(data.userUsageLimit) || data.userUsageLimit < 1)) {
        errors.userUsageLimit = "User usage limit must be at least 1";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};
