const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Wishlist = require("../model/wishlistSchema.js");
const Cart = require("../model/cartSchema.js");
const Order = require("../model/orderModel.js");
const Coupon = require("../model/couponSchema.js");

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
        // Fetch all coupons from the database
        const coupons = await Coupon.find({});

        // Render the coupons page with fetched coupons
        res.render("coupons", {
            coupons: coupons || [],
            pageTitle: "Coupons List",
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

module.exports = {
    loadAddCoupon,
    postAddCoupon,
    listCoupons,
};

// Validation helper functions
const validateCouponInput = (data) => {
    const errors = {};

    // Validate required fields
    if (!data.code || typeof data.code !== "string" || data.code.trim() === "") {
        errors.code = "Coupon code is required";
    } else if (!/^[A-Za-z0-9]+$/.test(data.code)) {
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
