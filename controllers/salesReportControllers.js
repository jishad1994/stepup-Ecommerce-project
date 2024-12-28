const Order = require("../model/orderModel");
const PDFDocument = require("pdfkit");
const helpers = require("../helpers/helper");

//load generator page
const loadGeneratorPage = async (req, res) => {
    try {
        res.render("salesReports");
    } catch (error) {}
};

//generate sales report
const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate, format } = req.body;
        console.log('req body',req.body);
        let query = {};
        let dateRange = {};

        // Set date range based on report type
        switch (reportType) {
            case "daily":
                dateRange = {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 1)),
                };
                break;
            case "weekly":
                dateRange = {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 7)),
                };
                break;
            case "yearly":
                dateRange = {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)),
                };
                break;
            case "custom":
                dateRange = {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)),
                };
                break;
        }

        query.createdAt = dateRange;
        query.status = { $nin: ["Cancelled", "Returned"] }; // Exclude cancelled/returned orders

        // Aggregate pipeline for sales report
        const salesReport = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSales: { $sum: "$totalPrice" },
                    totalShipping: { $sum: "$shippingFee" },
                    discountedOrders: {
                        $sum: { $cond: [{ $eq: ["$couponApplied", true] }, 1, 0] },
                    },
                    totalDiscount: {
                        $sum: {
                            $cond: [{ $eq: ["$couponApplied", true] }, "$couponDetails.discountAmount", 0],
                        },
                    },
                },
            },
        ]);

        // Get daily breakdown
        const dailyBreakdown = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" },
                    discount: {
                        $sum: {
                            $cond: [{ $eq: ["$couponApplied", true] }, "$couponDetails.discountAmount", 0],
                        },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Popular products during this period
        const popularProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
        ]);

        const reportData = {
            summary: salesReport[0] || {
                totalOrders: 0,
                totalSales: 0,
                totalShipping: 0,
                discountedOrders: 0,
                totalDiscount: 0,
            },
            dailyBreakdown,
            popularProducts,
            dateRange: {
                start: new Date(startDate),
                end: new Date(endDate || startDate),
            },
        };

        if (format === "pdf") {
            // Generate PDF report
            const pdfDoc = await helpers.generatePDFReport(reportData);
            res.contentType("application/pdf");
            res.send(pdfDoc);
        } else if (format === "excel") {
            // Generate Excel report
            const excelBuffer = await helpers.generateExcelReport(reportData);
            res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.send(excelBuffer);
        } else {
            // Send JSON response for preview
            res.json({
                success: true,
                data: reportData,
            });
        }
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate sales report",
        });
    }
};

module.exports = {
    loadGeneratorPage,
    generateSalesReport,
};
