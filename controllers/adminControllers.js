const User = require("../model/userModel");
const bcrypt = require("bcrypt");
const Order = require("../model/orderModel");
const Product = require("../model/productModel");
const mongoose = require("mongoose");
const Category = require("../model/categoryModel");
const Wallet = require("../model/walletModel");
const crypto = require("crypto");

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
        const isPasswordMatch = bcrypt.compare(password, isAdmin.password);
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
        const timeFilter = req.query.timeFilter || "monthly";

        // Create date filter based on selected time period
        const dateFilter = getDateFilter(timeFilter);

        // Get top products
        const topProducts = await Order.aggregate([
            {
                $match: {
                    createdAt: dateFilter,
                    "items.status": { $nin: ["Cancelled", "Returned"] },
                },
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    count: { $sum: "$items.quantity" },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $project: {
                    name: "$product.productName",
                    count: 1,
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        console.log("top products are", topProducts);

        // Get top categories
        const topCategories = await Order.aggregate([
            {
                $match: {
                    createdAt: dateFilter,
                    "items.status": { $nin: ["Cancelled", "Returned"] },
                },
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.category",
                    count: { $sum: "$items.quantity" },
                },
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category",
                },
            },
            { $unwind: "$category" },
            {
                $project: {
                    name: "$category.name",
                    count: 1,
                    _id: 1,
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]);

        //find total revenue

        const totalRevenueWithShippingCharge = await Order.aggregate([
            {
                $match: { paymentStatus: "Success", status: { $nin: ["Cancelled", "Returned"] } },
            },
            {
                $group: {
                    _id: null,
                    sum: { $sum: "$totalPrice" },
                    count: { $sum: 1 },
                },
            },
        ]);

        //finding total Product

        const totalProducts = await Product.countDocuments({ status: "Available" });

        // Check if totalRevenueWithShippingCharge has results
        let totalRevenue = 0;
        let totalOrders = 0;
        if (totalRevenueWithShippingCharge.length > 0) {
            totalRevenue = totalRevenueWithShippingCharge[0].sum - totalRevenueWithShippingCharge[0].count * 10;
            totalOrders = totalRevenueWithShippingCharge[0].count;
        }
        return res.render("dashBoard", { topProducts, topCategories, totalRevenue, totalOrders, totalProducts });
    } catch (error) {
        console.log("an error occured while loading dashboard page", error.message);
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

        console.log("the order object is :", order);

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
                    if (!["Cancelled", "Returned"].includes(item.status)) {
                        item.status = "Active";
                    }
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

const loadOrderReqs = async (req, res) => {
    try {
        // Pagination logic
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 8;
        const skip = (page - 1) * limit;

        const orderReturnRequests = await Order.find({
            "returnRequest.status": "Pending",
        })
            .sort("-returnRequest.requestDate")
            .skip(skip)
            .limit(limit);
        // Pagination info
        const totalRequests = await Order.countDocuments({
            "returnRequest.status": "Pending",
        });
        const totalPages = Math.ceil(totalRequests / limit);

        res.render("orderReturnRequests", { orderReturnRequests, currentPage: page, totalPages, totalRequests });
    } catch (error) {
        console.error("Error fetching return requests:", error);
        res.status(500).send("Internal server error");
    }
};

//approve or reject order return
const orderApproveOrReject = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: "Order ID and status are required." });
        }

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status. Must be 'Approved' or 'Rejected'." });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Update return request
        order.returnRequest.adminResponse = {
            status,
            responseDate: new Date(),
            note: note || "", // Optional note
        };
        order.returnRequest.status = status;

        // Update order status
        order.status = status === "Approved" ? "Return Request Approved" : "Return Request Rejected";

        // Update item statuses
        const itemStatus = status === "Approved" ? "Return Approved" : "Return Rejected";
        order.items.forEach((item) => {
            item.status = itemStatus;
            item.returnRequest.status = status;
        });

        // Refund to wallet if approved
        if (status === "Approved") {
            const wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                return res.status(404).json({ success: false, message: "Wallet not found for the user." });
            }

            const transactionId = await generateUniqueTransactionId();
            wallet.balance += order.totalPrice;

            wallet.transactions.push({
                transactionId,
                type: "Credit",
                amount: order.totalPrice,
                description: "Order Return Refund",
            });

            await wallet.save();
        }
        order.paymentStatus = "Refunded";

        await order.save();

        res.json({ success: true, message: "Return request updated successfully." });
    } catch (error) {
        console.error("Error updating return request:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Helper function to generate a unique transaction ID
async function generateUniqueTransactionId() {
    let transactionId;
    do {
        const timestamp = Date.now().toString();
        const randomString = crypto.randomBytes(4).toString("hex");
        transactionId = `TXN-${timestamp}-${randomString}`;

        const exists = await Wallet.findOne({ "transactions.transactionId": transactionId });
        if (!exists) break;
    } while (true);

    return transactionId;
}

//loda item return reqs page
const loadItemReturnReqs = async (req, res) => {
    try {
        // Pagination logic
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 8;
        const skip = (page - 1) * limit;

        // Pipeline to unwind and filter items with pending return requests
        const itemReturnRequests = await Order.aggregate([
            // Unwind the items array to work with individual items
            { $unwind: "$items" },

            // Match only items with pending return requests
            {
                $match: {
                    "items.returnRequest.status": "Pending",
                },
            },

            // Sort by the item's return request date
            {
                $sort: {
                    "items.returnRequest.requestDate": -1,
                },
            },

            // Lookup product details from the Products collection
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },

            // Flatten the productDetails array (optional if only one match is expected)
            {
                $unwind: {
                    path: "$productDetails",
                    preserveNullAndEmptyArrays: true, // Retain items without a matching product
                },
            },
            // Project relevant fields
            {
                $project: {
                    _id: 1, // Order ID
                    userId: 1,
                    orderId: 1,
                    address: 1,
                    "items._id": 1,
                    "items.productId": 1,
                    "items.quantity": 1,
                    "items.price": 1,
                    "items.size": 1,
                    "items.status": 1,
                    "items.returnRequest": 1,
                    productDetails: 1, // Include the joined product details
                },
            },

            // Skip and limit for pagination
            { $skip: skip },
            { $limit: limit },
        ]).exec();

        console.log("hii total item return reqs", itemReturnRequests);
        // Count total requests using the same filtering logic
        const totalRequestsPipeline = [
            { $unwind: "$items" },
            {
                $match: {
                    "items.returnRequest.status": "Pending",
                },
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                },
            },
        ];

        const totalRequestsResult = await Order.aggregate(totalRequestsPipeline);
        const totalRequests = totalRequestsResult.length > 0 ? totalRequestsResult[0].count : 0;
        const totalPages = Math.ceil(totalRequests / limit);

        res.render("itemReturnRequests", {
            itemReturnRequests,
            currentPage: page,
            totalPages,
            totalRequests,
        });
    } catch (error) {
        console.error("Error fetching return requests:", error);
        res.status(500).send("Internal server error");
    }
};
//approve or reject item return
const itemApproveOrReject = async (req, res) => {
    try {
        const { orderId, itemId } = req.query;
        const { status, note } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        item.returnRequest.adminResponse = {
            status,
            responseDate: new Date(),
            note,
        };

        item.returnRequest.status = status;
        item.status = status === "Approved" ? "Return Approved" : "Return Rejected";

        // Recalculate order totals if return is approved
        if (status === "Approved") {
            const activeItems = order.items.filter(
                (i) => !["Cancelled", "Return Approved", "Returned", "Return Rejected"].includes(i.status)
            );

            if (activeItems.length === 0) {
                order.status = "Returned";
                order.paymentStatus="Refunded"
            }

            // Recalculate totals considering returns
            const refundAmount = await calculateRefundAmount(orderId, itemId);
            console.log("refund amound is", refundAmount);
            order.totalPrice = Number(order.totalPrice - refundAmount);
            order.totalItems -= item.quantity;
            const wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                return res.status(404).json({ success: false, message: "Wallet not found for the user." });
            }

            const transactionId = await generateUniqueTransactionId();
            wallet.balance += refundAmount;

            wallet.transactions.push({
                transactionId,
                type: "Credit",
                amount: refundAmount,
                description: "Item Return Refund",
            });

            await wallet.save();
        }

        await order.save();

        res.json({ success: true, message: "Return request updated successfully" });
    } catch (error) {
        console.error("Error updating return request:", error.message);
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
    loadOrderReqs,
    orderApproveOrReject,
    loadItemReturnReqs,
    itemApproveOrReject,
};

//calculate refund amount
const calculateRefundAmount = async (orderId, returnedItemId) => {
    try {
        // Fetch the complete order
        const order = await Order.findById(orderId);

        console.dir(order);
        if (!order) {
            throw new Error("Order not found");
        }

        // Find the returned item in the order
        const returnedItem = order.items.find((item) => item._id.toString() === returnedItemId);

        if (!returnedItem) {
            throw new Error("Item not found in order");
        }

        // Calculate basic refund amount for the item
        const itemTotal = returnedItem.price * returnedItem.quantity;


        // If no coupon was applied, return the item total
        if (!order.couponApplied) {
            console.log("returned item total");
            return itemTotal;
        }

        // Calculate remaining order total without the returned item
        let remainingItemsTotal;
        if (order.items.length == 1) {
            remainingItemsTotal = 10; //shipping charge
        } else {
            remainingItemsTotal = order.totalPrice - itemTotal;
        }

        console.log("remaining item total", remainingItemsTotal);

        // Handle coupon adjustments
        const couponDetails = order.couponDetails;
        let refundAmount = itemTotal;

        if (couponDetails.discountType === "percentage") {
            console.log("discount type is percentage ");
            // Calculate proportional discount for the returned item
            const percentageDiscount = (itemTotal * couponDetails.discountAmount) / 100;
            console.log("percentage discount", percentageDiscount);
            refundAmount = itemTotal - percentageDiscount;

            // If there was a maximum discount cap
            // if (couponDetails.discountAmount) {
            //     const proportionalDiscount = (itemTotal / order.totalPrice) * couponDetails.discountAmount;
            //     refundAmount = itemTotal - proportionalDiscount;
            //     console.log("refund amound is now",refundAmount)
            // }
        } else if (couponDetails.discountType === "flat") {
            // Calculate proportional flat discount
            const proportionalDiscount = (itemTotal / order.totalPrice) * couponDetails.discountAmount;
            refundAmount = itemTotal - proportionalDiscount;
        }

        // Check if remaining order still qualifies for coupon
        const coupon = await mongoose.model("Coupon").findById(couponDetails.couponId);
        // if (coupon && remainingItemsTotal < coupon.minOrderValue) {
        //     // If remaining items don't qualify for coupon, return full item price
        //     refundAmount = itemTotal;
        // }
        console.log("finally", Math.round(refundAmount * 100) / 100);

        return Math.round(refundAmount * 100) / 100; // Round to 2 decimal places
    } catch (error) {
        console.error("Error calculating refund amount:", error);
        throw error;
    }
};

// Helper function to get date filter based on selected time period
function getDateFilter(timeFilter) {
    const now = new Date();
    const startDate = new Date();

    switch (timeFilter) {
        case "daily":
            startDate.setHours(0, 0, 0, 0);
            break;
        case "weekly":
            startDate.setDate(now.getDate() - 7);
            break;
        case "monthly":
            startDate.setMonth(now.getMonth() - 1);
            break;
        case "yearly":
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        default:
            startDate.setMonth(now.getMonth() - 1); // Default to monthly
    }

    return { $gte: startDate, $lte: now };
}
