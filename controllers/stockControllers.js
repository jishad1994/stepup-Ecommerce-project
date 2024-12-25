const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const Order = require("../model/orderModel");
const Product = require("../model/productModel");
const mongoose = require("mongoose");
const Category = require("../model/categoryModel");

//list stock of the products
const listStocks = async (req, res) => {
    try {
        //paging logic for how many data to fetch and display
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Get category filter from query params
        const categoryFilter = req.query.category;

        // Build the query based on category filter
        let query = {};
        if (categoryFilter && categoryFilter !== "all") {
            query.category = categoryFilter;
        }

        // Get products with filter
        const products = await Product.find(query).sort({ totalStock: 1 }).skip(skip).limit(limit);

        // Find the category names
        await Promise.all(
            products.map(async (product) => {
                const categoryId = product.category;
                const category = await Category.findById(categoryId);
                if (category) {
                    product.categoryName = category.name;
                }
            })
        );

        // Get all categories for the filter dropdown
        const categories = await Category.find({});

        // Count total products based on filter
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("listStock", {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            categories,
            selectedCategory: categoryFilter || "all",
        });
    } catch (error) {
        console.log("error while listing stock page", error.message);
        res.redirect("/admin/errorpage");
    }
};

const loadAddStock = async (req, res) => {
    try {
        // Fetch product by ID
        const product = await Product.findOne({ _id: req.query._id });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        //fetch the current category of the product
        const currentCategory = await Category.findOne({ _id: product.category });

        product.currentCategory = currentCategory;

        // Fetch all categories (optional: filter by isListed if needed)
        const categories = await Category.find({});

        // Render edit page with product and categories
        res.render("addStock", {
            product,
            categories,
        });
    } catch (error) {
        console.error("Error loading edit products page:", error.message);
        res.status(500).json({ message: "An internal error occurred. Please try again later." });
    }
};

//post udate stock

const postAddStock = async (req, res) => {
    try {
        const { productId, stock } = req.body;

        if (!Array.isArray(stock) || stock.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Stock must be a non-empty array",
            });
        }

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        product.stock = stock;
        await product.save();

        return res.status(200).json({
            success: true,
            message: "Stock updated successfully!",
        });
    } catch (error) {
        console.error("Error updating stock:", error);
        return res.status(500).json({
            success: false,
            message: "An internal error occurred",
        });
    }
};

module.exports = {
    listStocks,
    loadAddStock,
    postAddStock,
};
