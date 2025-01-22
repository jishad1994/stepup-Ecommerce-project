const Product = require("../model/productModel");
const Category = require("../model/categoryModel");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const { default: mongoose } = require("mongoose");

//load add products

const loadAddProducts = async (req, res) => {
    try {
        //only show listed categories
        const categories = await Category.find({ isListed: true });

        res.render("addProducts", { categories });
    } catch (error) {
        console.log("error while adding products page loading", error.message);
        res.status(500).json({ success: false, message: "An internal error occured.! Please try again later" });
    }
};

//add image multer middleware
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

//edit image upload multer
const editUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        console.log("Received file:", file.originalname, file.mimetype); // Debug logging
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/png"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}`), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5, // Limit number of files
    },
});

const addProducts = async (req, res) => {
    try {
        const { title, description, regularPrice, salePrice, stock, category, isFeatured, productOffer } = req.body;

        // Comprehensive input validation
        const errors = [];

        if (!title || title.trim() === "") errors.push("Title is required");
        if (!stock || stock.length == 0) errors.push("quantity cannot be zero while adding product");
        if (productOffer > 100 || productOffer < 0) errors.push("Add a valid offer percentage");
        if (!description || description.trim() === "") errors.push("Description is required");
        if (!regularPrice || isNaN(parseFloat(regularPrice)) || parseFloat(regularPrice) <= 0)
            errors.push("Invalid regular price");
        if (!salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0) errors.push("Invalid sale price");
        if (parseFloat(salePrice) > parseFloat(regularPrice)) errors.push("Sale price cannot exceed regular price");
        if (!category) errors.push("Category is required");
        if (!req.files || req.files.length < 3) errors.push("Minimum 3 images required");

        if (productOffer && productOffer >= 90) errors.push("Product Offer Cannot Be Given More Than 90 %");

        //check the product name alreday exists

        const isNameExists = await Product.findOne({ productName: { $regex: `^${title}$`, $options: "i" } });

        if (isNameExists) {
            console.error("Product name already exists");
            return res.status(400).json({
                success: false,
                message: "Product Name Already Exists.Try New One",
            });
        }

        // If any validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({
                message: "Validation Failed",
                errors,
            });
        }

        const ensureDirectoryExists = async (dirPath) => {
            try {
                await fs.mkdir(dirPath, { recursive: true }); // Creates the directory if it doesn't exist
            } catch (err) {
                console.error(`Error ensuring directory ${dirPath} exists:`, err.message);
            }
        };

        // Ensure upload directory exists
        const uploadDir = path.resolve(__dirname, "../public/uploads/products");
        await ensureDirectoryExists(uploadDir);

        // Process and save images
        const imageUrls = await Promise.all(
            req.files.map(async (file) => {
                try {
                    const filename = `${uuidv4()}.webp`;
                    const outputPath = path.join(uploadDir, filename);

                    await sharp(file.buffer)
                        .resize(800, 800, {
                            fit: sharp.fit.inside,
                            withoutEnlargement: true,
                        })
                        .webp({ quality: 80 })
                        .toFile(outputPath);

                    return `/uploads/products/${filename}`;
                } catch (err) {
                    console.error(`Error processing file ${file.originalname}:`, err.message);
                    throw new Error("Image processing failed");
                }
            })
        );

        // Handle product offer

        let isOfferApplied;
        let offerPrice;
        if (productOffer && productOffer > 0) {
            isOfferApplied = true;

            offerPrice = salePrice * (1 - productOffer / 100); // Calculate discounted price
        } else {
            isOfferApplied = false;

            offerPrice = 0;
        }

        // Create product in database
        const newProduct = await Product.create({
            productName: title,
            description,
            regularPrice: parseFloat(regularPrice),
            salePrice: parseFloat(salePrice),
            stock: JSON.parse(stock),
            category,
            isOfferApplied,
            productOffer,
            offerPrice,
            productImage: imageUrls,
            isFeatured,
        });

        res.status(201).json({
            message: "Product added successfully",
            product: newProduct,
        });
    } catch (error) {
        console.error("Product upload error:", error);
        res.status(500).json({
            message: "Failed to add product",
            error: error.message,
        });
    }
};

//list products

const listProducts = async (req, res) => {
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
        const products = await Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

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

        res.render("listProducts", {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            categories,
            selectedCategory: categoryFilter || "all",
        });
    } catch (error) {
        console.log("error while loading products list page", error);
        res.redirect("/admin/errorpage");
    }
};

//soft delete
const softDelete = async (req, res) => {
    try {
        // Retrieve product ID from query parameters
        const { _id } = req.query;

        // Find the product by ID
        const product = await Product.findOne({ _id });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Toggle the isListed status
        const updatedStatus = !product.isListed;
        await Product.updateOne({ _id }, { $set: { isListed: updatedStatus } });

        // Redirect back to the product list
        res.redirect("/admin/listProducts");
    } catch (error) {
        console.error("Error in softDelete function:", error.message);
        res.redirect("/admin/errorpage");
    }
};
//edit products

const loadEditProductsPage = async (req, res) => {
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
        res.render("editProducts", {
            product,
            categories,
        });
    } catch (error) {
        console.error("Error loading edit products page:", error.message);
        res.status(500).json({ message: "An internal error occurred. Please try again later." });
    }
};

//edit product
const editProduct = async (req, res) => {
    try {
        const { productId, title, description, regularPrice, salePrice, category, stock, productOffer } = req.body;

        // Validate input
        const errors = [];
        if (!title || title.trim() === "") errors.push("Title is required");
        if (!stock || stock.length === 0) errors.push("Stock quantity is not added");
        if (productOffer > 100 || productOffer < 0) errors.push("Add a valid offer percentage");
        if (!description || description.trim() === "") errors.push("Description is required");
        if (!regularPrice || isNaN(parseFloat(regularPrice)) || parseFloat(regularPrice) <= 0)
            errors.push("Invalid regular price");
        if (!salePrice || isNaN(parseFloat(salePrice)) || parseFloat(salePrice) <= 0) errors.push("Invalid sale price");
        if (parseFloat(salePrice) > parseFloat(regularPrice)) errors.push("Sale price cannot exceed regular price");
        if (!category) errors.push("Category is required");

        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: "Validation Failed", errors });
        }

        // Check if the product name already exists
        const isNameExists = await Product.findOne({
            _id: { $ne: productId },
            productName: { $regex: `^${title}$`, $options: "i" },
        });

        if (isNameExists) {
            return res.status(400).json({
                success: false,
                message: "Product Name Already Exists. Try a new one.",
            });
        }

        // Find existing product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Update product fields
        product.productName = title;
        product.description = description;
        product.regularPrice = parseFloat(regularPrice);
        product.category = category;
        product.stock = JSON.parse(stock);

        // Handle product offer
        if (productOffer && productOffer > 0) {
            product.isOfferApplied = true;
            product.productOffer = productOffer;
            product.offerPrice = product.salePrice * (1 - productOffer / 100); // Calculate discounted price
        } else {
            console.log("no product offer found");
            product.isOfferApplied = false;
            product.productOffer = 0;
            product.offerPrice = 0;
        }

        // Handle sale price
        product.salePrice = parseFloat(salePrice);

        // Handle images
        const uploadDir = path.resolve(__dirname, "../public/uploads/products");
        const newImages = req.files.map(async (file) => {
            const filename = `${uuidv4()}.webp`;
            const outputPath = path.join(uploadDir, filename);
            await sharp(file.buffer)
                .resize(800, 800, { fit: sharp.fit.inside, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(outputPath);
            return `/uploads/products/${filename}`;
        });

        // Avoid uploading duplicate images
        const imageUrls = await Promise.all(newImages);
        imageUrls.forEach((imageUrl) => {
            if (!product.productImage.includes(imageUrl)) {
                product.productImage.push(imageUrl);
            }
        });

        // Check minimum image count
        if (product.productImage.length < 3) {
            return res.status(400).json({ success: false, message: "At least 3 different images should be uploaded." });
        }

        // Save updated product
        await product.save();

        res.status(200).json({ success: true, message: "Product updated successfully!" });
    } catch (error) {
        console.error("Error updating product:", error.message);
        res.status(500).json({ success: false, message: "An internal error occurred." });
    }
};

//delete the image from products

const deleteImg = async (req, res) => {
    try {
        console.log(req.body);
        const { imageIndex, _id } = req.body;
        if (!imageIndex || !_id) {
            console.log("no image index found");
            return res.status(400).json({ success: false, message: "no imageindexfound or id found" });
        }

        //find the product

        const product = await Product.findOne({ _id });
        if (!product) {
            console.log("no product found");
            return res.status(400).json({ success: false, message: "no productfound" });
        }
        //delete the image from the array using splice
        product.productImage.splice(imageIndex, 1);
        await product.save();
        console.log("image deleted successfully");
        return res.status(200).json({ success: true, message: "image deleted successfully" });
    } catch (error) {
        console.log("internal server error");
        return res.status(500).json({ success: false, message: "internal server error" });
    }
};

//check stock of the product

const checkStock = async (req, res) => {
    try {
        const { size, productId } = req.body;

        const rawProductId = new mongoose.Types.ObjectId(productId);
        const product = await Product.findOne({ _id: rawProductId });

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Find the stock item with the matching size
        const stockItem = product.stock.find((item) => item.size === size);

        if (!stockItem) {
            return res.status(404).json({ success: false, message: "Size not found" });
        }

        res.status(200).json({ quantity: stockItem.quantity });
    } catch (error) {
        console.error("Error while fetching quantity:", error.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadAddProducts,
    addProducts,
    upload,
    editUpload,
    listProducts,
    softDelete,
    loadEditProductsPage,
    editProduct,
    deleteImg,
    checkStock,
};
