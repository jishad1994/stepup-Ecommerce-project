const mongoose = require("mongoose");
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const bcrypt = require("bcrypt");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const env = require("dotenv").config();
const jwt = require("jsonwebtoken");
const Address = require("../model/addressModel.js");

//load home apge
const loadHomePage = async (req, res) => {
    try {
        res.render("index");
    } catch (err) {
        console.error("Error while loading the home page:", err.message);
        res.status(500).render("error", {
            message: "An error occurred while loading the home page. Please try again later.",
        });
    }
};

//signuip
const loadSignup = async (req, res) => {
    try {
        res.render("signup");
    } catch (err) {
        console.log("signup page loading error");
        res.status(400).send(`Error while loading signup page: ${err.message}`);
    }
};

//signin
const loadSignin = async (req, res) => {
    try {
        res.render("login");
    } catch (err) {
        console.log("login page loading error");
        res.status(400).send(`Error while loading login page: ${err.message}`);
    }
};

//shop all or category wise
const shopCategory = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        // Get sort parameter from query
        const sortOption = req.query.sort || "default";

        // Define sort configurations
        const sortConfigs = {
            default: {},
            featured: { isFeatured: -1 },
            newArrivals: { createdAt: -1 },
            nameAZ: { productName: 1 },
            nameZA: { productName: -1 },
            popularity: { purchaseCount: -1 },
            priceLowToHigh: { regularPrice: 1 },
            priceHighToLow: { regularPrice: -1 },
            rating: { averageRating: -1 },
        };

        // Get the sort configuration
        const sortConfig = sortConfigs[sortOption];
        const categoryId = req.params.id ? new mongoose.Types.ObjectId(req.params.id) : null;
        console.log("hii category is ", categoryId);

        //decide the category
        var categoryTitle;

        if (categoryId.toString() == "674f1f1662333c214cfac645") {
            categoryTitle = "men";
        } else if (categoryId.toString() == "674f1f2762333c214cfac64c") {
            categoryTitle = "women";
        } else if (categoryId.toString() == "674f1f3662333c214cfac653") {
            categoryTitle = "kids";
        }
        console.log("categry name is", categoryTitle);

        // Build base query
        let baseQuery = { isListed: true };

        if (sortOption == "featured") {
            baseQuery = { isListed: true, isFeatured: true };
        }
        if (categoryId) {
            baseQuery.category = categoryId;
        }

        // Check if category is listed (if category is specified)
        if (categoryId) {
            const isListed = await Category.findOne({
                _id: categoryId,
                isListed: true,
            });

            if (!isListed) {
                return res.render("shopCategory", {
                    products: [],
                    menCount: 0,
                    womenCount: 0,
                    kidsCount: 0,
                    currentSort: sortOption,
                    pagination: {
                        currentPage: 1,
                        hasNextPage: false,
                        hasPrevPage: false,
                        pages: [1],
                        totalPages: 1,
                    },
                });
            }
        }

        // Parallel queries for counts and products
        const [menCount, womenCount, kidsCount, totalProducts, products] = await Promise.all([
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f1662333c214cfac645"),
                isListed: true,
            }),
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f2762333c214cfac64c"),
                isListed: true,
            }),
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f3662333c214cfac653"),
                isListed: true,
            }),
            Product.countDocuments(baseQuery),
            Product.find(baseQuery).sort(sortConfig).skip(skip).limit(limit).lean(),
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Generate page numbers
        let pages = [];
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            pages.push(i);
        }

        res.render("shopCategory", {
            categoryTitle: categoryTitle,
            products,
            menCount,
            womenCount,
            kidsCount,
            currentSort: sortOption,
            pagination: {
                currentPage: page,
                hasNextPage,
                hasPrevPage,
                pages,
                totalPages,
                nextPage: page + 1,
                prevPage: page - 1,
                categoryId: req.params.id,
            },
        });
    } catch (error) {
        console.error("Error in shop category:", error.message);
        res.status(500).render("404", {
            error: "Failed to load the shop page. Please try again later.",
        });
    }
};

//shop all
const loadShopAll = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9;
        const skip = (page - 1) * limit;

        // Get sort parameter and search query
        const sortOption = req.query.sort || "default";
        const searchQuery = req.query.search || "";

        // Define sort configurations
        const sortConfigs = {
            default: {},
            featured: { isFeatured: -1 },
            newArrivals: { createdAt: -1 },
            nameAZ: { productName: 1 },
            nameZA: { productName: -1 },
            popularity: { purchaseCount: -1 },
            priceLowToHigh: { regularPrice: 1 },
            priceHighToLow: { regularPrice: -1 },
            rating: { averageRating: -1 },
        };
        // Build base query
        let baseQuery = { isListed: true };
        if (sortOption == "featured") {
            baseQuery = { isListed: true, isFeatured: true };
        }
        

        
        // Add search functionality
        if (searchQuery) {
            baseQuery.$or = [
                { productName: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } },
            ];
        }

        // Get listed categories
        const listedCategories = await Category.find({ isListed: true });
        const listedCategoryIds = listedCategories.map((category) => category._id);
        baseQuery.category = { $in: listedCategoryIds };

        // Parallel queries for counts and products
        const [menCount, womenCount, kidsCount, totalProducts, products] = await Promise.all([
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f1662333c214cfac645"),
                isListed: true,
            }),
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f2762333c214cfac64c"),
                isListed: true,
            }),
            Product.countDocuments({
                category: new mongoose.Types.ObjectId("674f1f3662333c214cfac653"),
                isListed: true,
            }),
            Product.countDocuments(baseQuery),
            Product.find(baseQuery).sort(sortConfigs[sortOption]).skip(skip).limit(limit).lean(),
        ]);

        // Calculate pagination values
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Create page numbers array
        let pages = [];
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            pages.push(i);
        }

        // Render the page
        res.render("shopAll", {
            products,
            menCount,
            womenCount,
            kidsCount,
            currentSort: sortOption,
            searchQuery,
            pagination: {
                currentPage: page,
                hasNextPage,
                hasPrevPage,
                pages,
                totalPages,
                nextPage: page + 1,
                prevPage: page - 1,
            },
        });
    } catch (error) {
        console.error("Error while loading shopAll page:", error.message);
        res.status(500).render("404", {
            error: "Failed to load the shop all page. Please try again later.",
        });
    }
};

//load shop single
const loadProduct = async (req, res) => {
    try {
        const _id = req.params.id; // Extract product ID from request parameters
        console.log("load product controller worked ");
        const product = await Product.findOne({ _id }); // Fetch the product details by ID

        if (!product) {
            return res.status(404).render("404");
        }

        //sendng stock for quantity showing purposeb while selecting size
        const stock = product.stock.map((stockItem) => {
            return { size: stockItem.size, quantity: stockItem.quantity };
        });
        console.log("hii stcock is :", stock);
        res.render("shop-single", {
            product,
            stock: JSON.stringify(stock), //for quantity showing purposeb while selecting size
        });
    } catch (error) {
        console.error("Error while loading single product:", error);
        res.status(500).render("404");
    }
};

//order confirmation

const orderConfirmed = async (req, res) => {
    try {
        res.render("thankyou");
    } catch (error) {
        console.log("error while confirming order", err);
    }
};

//wallet

const wallet = async (req, res) => {
    try {
        res.render("wallet");
    } catch (error) {
        console.log("error while loading wallet", error);
    }
};

//orders

//user profile

const userProfile = async (req, res) => {
    try {
        console.log("entered user profile controller");
        const email = req.user.email; //set while userauth
        const user = await User.findOne({ email });
        console.log("current user is:", user.name);

        res.render("userProfile", { user });
    } catch (error) {
        console.log("error while loading the use profile page", error);
        res.render("404");
    }
};

//logout

const logout = async (req, res) => {
    try {
        //clear the session if any

        req.session.destroy((err) => {
            console.error(err);
        });
        // Clear the JWT token from the client's cookies

        res.clearCookie("authToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        console.log("User logged out, auth token cleared.");
        return res.redirect("/");
    } catch (error) {
        console.error("Error during logout:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

//post signup
const signup = async (req, res) => {
    try {
        const { name, password, email, phone } = req.body;
        console.log(req.body);

        const emailTaken = await User.findOne({ email });
        const numberTaken = await User.findOne({ phone });
        if (emailTaken || numberTaken) {
            let errors = {};

            if (emailTaken) {
                errors.email = "Email is already in use";
            }

            if (numberTaken) {
                errors.phone = "Number is already taken";
            }

            return res.status(400).json({
                success: false,
                errors,
            });
        } else {
            // Generate OTP and set expiry
            const OTP = await genOTP();
            const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
            console.log(`The generated OTP is: ${OTP}`);

            // Store OTP and expiry in session
            req.session.userdata = { name, email, password, phone, OTP, expiry };

            // Send the OTP
            await sendOTP(email, OTP);

            return res.status(200).json({
                success: true,
                message: "User email available and OTP sent to email",
            });
        }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//resned otp

const resendOTP = async (req, res) => {
    try {
        const OTP = await genOTP();
        const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
        console.log(`The generated OTP is: ${OTP}`);

        // Update OTP and expiry in session
        req.session.userdata.OTP = OTP;
        req.session.userdata.expiry = expiry;

        const email = req.session.userdata.email;

        if (!email) {
            console.log("Session has expired and email not found");
            return res.status(400).json({
                success: false,
                message: "Session expired or email not found. Please try again.",
            });
        }

        await sendOTP(email, OTP);
        console.log("OTP has been resent,new OTP :", OTP);
        return res.status(200).json({
            success: true,
            message: "OTP has been resent to your email.",
        });
    } catch (err) {
        console.log("Error while resending OTP: ", err.message);
        res.status(400).json({
            success: false,
            message: "Failed to resend OTP. Please try again.",
        });
    }
};

const loadOtpPage = async (req, res) => {
    try {
        res.render("otpverification");
    } catch (err) {
        console.log("error while lodaing otp verification page:", err.message);
        res.status(404).json({ success: false, message: "error while loading otp page" });
    }
};

//otp verification page
const verifyOTP = async (req, res) => {
    try {
        console.log("request reached verify otp controller");
        const { OTP } = req.body;
        console.log(OTP);
        console.log(" he current session data is :", req.session.userdata);

        if (!req.session.userdata) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try again.",
            });
        }

        const isExpired = Date.now() > req.session.userdata.expiry;

        if (isExpired) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one.",
            });
        }

        if (OTP == req.session.userdata?.OTP) {
            console.log("OTP matches and verification successful");

            //Clear session OTP after successful verification
            req.session.userdata.OTP = null;

            console.log("the session data is:", req.session.userdata);
            password = req.session.userdata.password;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = await new User({
                name: req.session.userdata.name,
                email: req.session.userdata.email,
                password: hashedPassword,
                phone: req.session.userdata.phone,
            });

            await user.save();

            return res.status(200).json({
                success: true,
                message: "OTP verification is successful and Data saved in DB",
            });
        } else {
            console.log("otp else case worked");
            res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            message: "Error while comparing OTP",
        });
    }
};

//post login
const postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required.",
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        let errors = {};

        if (!user) {
            errors.email = "Invalid Username";
            return res.status(400).json({
                success: false,
                message: "Invalid login credentials.",
                errors,
            });
        }

        // Check if the user is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Your account is blocked. Please contact support.",
            });
        }

        // Compare hashed password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            errors.password = "Invalid password";
            return res.status(400).json({
                success: false,
                message: "Invalid login credentials.",
                errors,
            });
        }

        // Successful login
        console.log("User logged in successfully");

        // Creating user session

        const JWTSECRET = process.env.JWT_SECRET;
        req.user = { email, _id: user._id };

        req.session.userdata = { email, _id: user._id };
        req.session.save((err) => {
            if (err) console.error("Error saving session:", err);
        });
        //creating JWT token
        const token = jwt.sign({ email }, JWTSECRET, { expiresIn: "2h" });
        // Set the JWT as a cookie
        res.cookie("authToken", token, {
            httpOnly: true, // Prevent access via JavaScript
            secure: process.env.NODE_ENV === "production", // Use secure cookies in production
            maxAge: 2 * 60 * 60 * 1000, // 2 hour
        });

        console.log("JWT token set in cookie as authtoken", res.cookie.authtoken);

        console.log(`the req.session.userdata after logging in :${req.session.userdata}`);
        return res.status(200).json({
            success: true,
            message: "User logged in successfully",
            token, // token just to verify user in postman
        });
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred during login. Please try again later.",
        });
    }
};

//load edit proofile page
const loadEditProfile = async (req, res) => {
    try {
        const email = req.user?.email;
        //find user form DB for
        const user = await User.findOne({ email });
        if (!user) {
            console.log("user not found");
            return res.render("404");
        }

        //if user exists
        res.render("editProfile", { user });
    } catch (error) {
        console.log("error while loading userprofile edit page");
        res.status(404).json({ success: false, message: "error while profile edit page loading" });
    }
};

//post editProfile Controller

const postEditProfile = async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        // Corrected condition: Check if name or phone is missing
        if (!name || !phone) {
            console.log("Username or phone missing in the request body");
            return res.status(400).json({
                success: false,
                message: "Username or phone number is required",
            });
        }

        // Check if the phone number is already taken by another user
        const isPhoneTaken = await User.findOne({
            phone,
            email: { $ne: email },
        });

        if (isPhoneTaken) {
            console.log("Phone number is already in use");
            return res.status(400).json({
                success: false,
                message: "Phone number is already used by another user",
            });
        }

        // Update user profile
        const updateResult = await User.updateOne({ email }, { $set: { phone, name } });

        console.log(updateResult);

        // Check if the update was successful
        if (updateResult.modifiedCount > 0) {
            console.log("Profile update successful");
            return res.status(200).json({
                success: true,
                message: "User Profile Updated Successfully",
            });
        } else {
            // Handle case where no document was modified
            console.log("No document was updated");
            return res.status(404).json({
                success: false,
                message: "User not found or no changes made",
            });
        }
    } catch (error) {
        console.error("Error during profile update:", error);
        return res.status(500).json({
            success: false,
            message: "Unexpected server-side error",
            error: error.message,
        });
    }
};
module.exports = {
    loadSignup,
    loadSignin,
    signup,
    loadOtpPage,
    resendOTP,
    verifyOTP,
    loadHomePage,
    postLogin,
    logout,
    loadShopAll,
    loadProduct,
    orderConfirmed,
    wallet,
    userProfile,
    shopCategory,
    loadEditProfile,
    postEditProfile,
};
