const Order = require("../model/orderModel");
const mongoose= require("mongoose")

// Route handler for analytics
const getChart = async (req, res) => {
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

        res.json({ topProducts, topCategories });
    } catch (error) {
        console.error("Analytics Error:", error.message);
        res.status(500).json({ error: "Error fetching analytics data" });
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

module.exports = {
    getChart,
};
