const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const Order = require("../model/orderModel");
const Product = require("../model/productModel");
const mongoose = require("mongoose");
const Category = require("../model/categoryModel");

const loadAdminLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            console.log("Admin session exists. Redirecting to dashboard...");
            return res.redirect("/admin/dashBoard");
        } else {
            res.render("adminLogin");
        }
    } catch (error) {
        console.error("Error while loading admin login page:", error);
        res.render("404", { message: "Unable to load admin login page. Please try again later." });
    }
};

//post login
const postAdminLogin = async (req, res) => {
    try {
        console.log("post login worked");
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required.",
            });
        }

        // Check if admin exists
        const isAdmin = await User.findOne({ email, isAdmin: true });
        if (!isAdmin) {
            console.log("admin not find condition worked");
            return res.status(400).json({
                success: false,
                message: "Invalid credentials.",
            });
        }

        // Compare password
        const isPasswordMatch = await bcrypt.compare(password, isAdmin.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials.",
            });
        }

        // Save session
        req.session.admin = {
            id: isAdmin._id,
            name: isAdmin.name,
            isLoggedIn: true,
        };

        // Respond with success
        console.log("admin login successfull");
        return res.status(200).json({
            success: true,
            message: "Admin login successful.",
        });
    } catch (error) {
        console.error("Error during admin login:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

//load error page

const loadErrorpage = async (req, res) => {
    res.render("errorpage");
};

//load admin dashbaord
const loadAdminDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            console.log("admis session is:", req.session.admin);
            return res.render("dashBoard");
        } else {
            res.redirect("/admin/login");
        }
    } catch (error) {
        console.log("an error occured while loading dashboard page");
        res.render("404");
    }
};

//logout
const logout = async (req, res) => {
    try {
        await req.session.destroy((err) => {
            if (err) {
                console.error("Error while destroying session:", err);
                return res.redirect("/admin/errorpage");
            }

            console.log("Session destroyed successfully. Logging out user.");
            // Optional: Add a success message to the login page
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.error("Unexpected error during logout:", error);
        res.redirect("/admin/errorpage");
    }
};

///user management
const userInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const search = req.query.search || "";

        const query = {
            // isAdmin: false,
            // isAdmin: true,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        };

        const userData = await User.find(query)
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await User.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        res.render("userInfo", {
            userData,
            currentPage: page,
            totalPages,
            search,
        });
    } catch (error) {
        console.error(error);
        res.status(500).render("error", { error: "An error occurred" });
    }
};

//BLOCK USER

const blockUser = async (req, res) => {
    try {
        console.log("blocking user");
        const id = req.query.id;

        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

        return res.redirect("/admin/users");
    } catch (error) {
        console.log("error while blocking user");
        res.redirect("/admin/errorpage");
    }
};

//UNBLOCK USER

const unblockUser = async (req, res) => {
    try {
        console.log("unblocking user");
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        return res.redirect("/admin/users");
    } catch (error) {
        console.log("error while unblocking user", error);
        res.redirect("/admin/errorpage");
    }
};

//list orders

const listOrders = async (req, res) => {
    try {
        // Pagination logic
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 8;
        const skip = (page - 1) * limit;

        // Fetch orders
        const orders = await Order.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const userIds = orders.map((order) => order.userId);
        const users = await User.find({ _id: { $in: userIds } });

        // Attach user emails to orders
        orders.forEach((order) => {
            const user = users.find((user) => user._id.toString() === order.userId.toString());
            order.userEmail = user ? user.email : "Unknown";
        });

        // Pagination info
        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        // Render the view
        return res.render("listOrders", {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
        });
    } catch (error) {
        console.error("Error while loading orders:", error.message);
        return res.redirect("/admin/errorpage");
    }
};

//show order details
const showOrderDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            console.error("No order ID found in params");
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        // Find the order
        const order = await Order.findById(id);
        if (!order) {
            console.error("Order not found");
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Fetch the product IDs from the order
        const productIds = order.items.map((item) => item.productId);
        if (!productIds.length) {
            console.warn("No products found in the order");
            return res.render("orderDetailsAdminSide", { order, products: [], user: null });
        }

        // Fetch the products
        const productDetails = await Product.find({ _id: { $in: productIds } });
        console.log("product details", productDetails);

        // Enhanced mapping with detailed logging
        order.items = order.items.map((item) => {
            const product = productDetails.find((prod) => prod._id.equals(item.productId));

            if (!product) {
                console.warn(`Product not found for ID: ${item.productId}`);
            }

            return {
                ...item.toObject(),
                product: product || null,
            };
        });

        console.log("the order object is :", order.items);

        // Find the user associated with the order or use default values
        const user = (await User.findById(order.userId)) || { name: "Unknown", email: "Unknown" };

        // Render the order details page
        res.render("orderDetailsAdminSide", {
            order,
            products: productDetails, // Optional if detailed items are already in `order.items`
            user,
        });
    } catch (error) {
        console.error("Internal server error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//change order status
const changeOrderStatus = async (req, res) => {
    try {
        const { selectedStatus, currentStatus, _id } = req.body;

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned"];

        // Validate inputs
        if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }

        if (!selectedStatus) {
            return res.status(400).json({ success: false, message: "Please select a valid status" });
        }

        if (!validStatuses.includes(selectedStatus)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        if (selectedStatus === currentStatus) {
            return res.status(400).json({ success: false, message: "Cannot change to this status" });
        }

        // Fetch the order
        const order = await Order.findOne({ _id });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Update the status
        order.status = selectedStatus;

        if (!["Cancelled", "Return Request", "Returned"].includes(order.status)) {
            //change all status of products
            await Promise.all(
                order.items.map(async (item) => {
                    item.status = "Active";
                })
            );
        }
        await order.save();

        console.log("Order status changed successfully");
        res.status(200).json({
            success: true,
            message: "Status changed successfully",
            order,
        });
    } catch (error) {
        console.error("Error changing order status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadAdminLogin,
    postAdminLogin,
    loadAdminDashboard,
    logout,
    loadErrorpage,
    userInfo,
    blockUser,
    unblockUser,
    listOrders,
    showOrderDetails,
    changeOrderStatus,
};
