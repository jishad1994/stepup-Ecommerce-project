//
const ExcelJS = require("exceljs");
const Order = require("../model/orderModel");
const PDFDocument = require("pdfkit");

const path = require("path");
// const helpers = require("../helpers/helper");

//load generator page
const loadGeneratorPage = async (req, res) => {
    try {
        // Render the salesReports page
        res.render("salesReports");
    } catch (error) {
        console.error("Error loading the generator page:", error);

        res.status(500).send("An error occurred while loading the page. Please try again later.");
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate, format } = req.body;
        let query = {};
        let dateRange = {};

        // Enhanced date range handling
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
            case "monthly":
                dateRange = {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)),
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
        // query.status = "Pending";
        query.status = { $nin: ["Cancelled", "Returned","Return Request Approved"] }; // Exclude cancelled/returned orders

        // Enhanced Sales Analytics
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
                    averageOrderValue: { $avg: "$totalPrice" },
                    maxOrderValue: { $max: "$totalPrice" },
                    minOrderValue: { $min: "$totalPrice" },
                    totalItems: { $sum: "$totalItems" },
                    uniqueCustomers: { $addToSet: "$userId" },
                },
            },
            {
                $addFields: {
                    discountRate: {
                        $multiply: [{ $divide: ["$totalDiscount", "$totalSales"] }, 100],
                    },
                    averageItemsPerOrder: {
                        $divide: ["$totalItems", "$totalOrders"],
                    },
                    uniqueCustomerCount: { $size: "$uniqueCustomers" },
                },
            },
        ]);

        // Enhanced Daily Breakdown
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
                    uniqueCustomers: { $addToSet: "$userId" },
                    totalItems: { $sum: "$totalItems" },
                    averageOrderValue: { $avg: "$totalPrice" },
                    shipping: { $sum: "$shippingFee" },
                },
            },
            {
                $addFields: {
                    uniqueCustomerCount: { $size: "$uniqueCustomers" },
                    netRevenue: { $subtract: ["$revenue", "$discount"] },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Fetch list of orders
        const orderList = await Order.find(query)
            .populate("userId", "name") // Populate user details
            .select("orderId userId totalPrice paymentType status createdAt") // Include necessary fields
            .sort({ createdAt: -1 }); // Sort by latest orders

        // Enhanced Popular Products Analysis
        const popularProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    orderCount: { $sum: 1 },
                    averageQuantityPerOrder: { $avg: "$items.quantity" },
                    uniqueCustomers: { $addToSet: "$userId" },
                    returnRate: {
                        $avg: {
                            $cond: [{ $in: ["$items.status", ["Return Pending", "Return Approved", "Returned"]] }, 1, 0],
                        },
                    },
                },
            },
            {
                $addFields: {
                    uniqueCustomerCount: { $size: "$uniqueCustomers" },
                },
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
        ]);

        // Payment Method Analysis
        const paymentAnalysis = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$paymentType",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$totalPrice" },
                    averageAmount: { $avg: "$totalPrice" },
                    successRate: {
                        $avg: {
                            $cond: [{ $eq: ["$paymentStatus", "Success"] }, 1, 0],
                        },
                    },
                },
            },
        ]);

        const reportData = {
            summary: {
                ...salesReport[0],
                netRevenue: salesReport[0]?.totalSales - salesReport[0]?.totalDiscount || 0,
                revenuePerCustomer: salesReport[0]?.totalSales / salesReport[0]?.uniqueCustomerCount || 0,
            },
            dailyBreakdown,
            popularProducts,
            orderList,
            paymentAnalysis,
            dateRange: {
                start: new Date(startDate),
                end: new Date(endDate || startDate),
                reportType,
            },
        };

        console.log(reportData);

        if (format === "pdf") {
            const pdfDoc = await generateEnhancedPDFReport(reportData);
            res.contentType("application/pdf");
            res.send(pdfDoc);
        } else if (format === "excel") {
            const excelBuffer = await generateEnhancedExcelReport(reportData);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=Detailed_Sales_Report.xlsx");
            res.send(excelBuffer);
        } else {
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

// generate pdf report
const generateEnhancedPDFReport = (reportData) => {
    return new Promise((resolve, reject) => {
        try {
            const notoSansRegular = path.join(__dirname, "..", "public", "styles", "fonts", "NotoSans-Regular.ttf");
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));

            // Enhanced Header
            doc.fontSize(24).font(notoSansRegular).text("Sales Analytics Report", { align: "center" }).moveDown(0.5);

            // Report Period
            doc.fontSize(12)
                .font(notoSansRegular)
                .text(
                    `Report Type: ${
                        reportData.dateRange.reportType.charAt(0).toUpperCase() + reportData.dateRange.reportType.slice(1)
                    }`,
                    { align: "center" }
                )
                .text(
                    `Period: ${reportData.dateRange.start.toLocaleDateString()} to ${reportData.dateRange.end.toLocaleDateString()}`,
                    { align: "center" }
                )
                .moveDown(2);

            // Executive Summary
            doc.fontSize(16).font(notoSansRegular).text("Executive Summary", { underline: true }).moveDown(0.5);

            const summaryData = [
                ["Metric", "Value"],
                ["Total Orders", reportData.summary.totalOrders],
                ["Net Revenue", `₹ ${reportData.summary.netRevenue.toFixed(2)}`],
                ["Average Order Value", `₹ ${reportData.summary.averageOrderValue.toFixed(2)}`],
                ["Total Customers", reportData.summary.uniqueCustomerCount],
                ["Revenue per Customer", `₹ ${reportData.summary.revenuePerCustomer.toFixed(2)}`],
                ["Discount Rate", `${reportData.summary.discountRate.toFixed(2)}%`],
                ["Items per Order", reportData.summary.averageItemsPerOrder.toFixed(2)],
            ];

            generateEnhancedTable(doc, summaryData);
            doc.moveDown(2);

            // Orders List Section
            doc.addPage().fontSize(16).text("Orders List", { underline: true }).moveDown(0.5);

            const orderTableData = [
                ["Order ID", "Customer", "Order Date", "Total Amount", "Payment Type", "Status"],
                ...reportData.orderList.map((order) => [
                    order.orderId,
                    order.userId?.name || "N/A",
                    new Date(order.createdAt).toLocaleDateString(),
                    `₹ ${order.totalPrice.toFixed(2)}`,
                    order.paymentType,
                    order.status,
                ]),
            ];

            generateEnhancedTable(doc, orderTableData);

            // Top Products Section
            doc.addPage().fontSize(16).text("Top Performing Products", { underline: true }).moveDown(0.5);

            const productData = [
                ["Product", "Revenue", "Quantity", "Return Rate", "Customer Count"],
                ...reportData.popularProducts.map((product) => [
                    product.productDetails[0]?.productName || "N/A",
                    `₹ ${product.totalRevenue.toFixed(2)}`,
                    product.totalQuantity,
                    `${(product.returnRate * 100).toFixed(2)}%`,
                    product.uniqueCustomerCount,
                ]),
            ];

            generateEnhancedTable(doc, productData);

            // Payment Analysis
            doc.addPage().fontSize(16).text("Payment Method Analysis", { underline: true }).moveDown(0.5);

            const paymentData = [
                ["Payment Method", "Count", "Total Amount", "Success Rate"],
                ...reportData.paymentAnalysis.map((payment) => [
                    payment._id,
                    payment.count,
                    `₹ ${payment.totalAmount.toFixed(2)}`,
                    `${(payment.successRate * 100).toFixed(2)}%`,
                ]),
            ];

            generateEnhancedTable(doc, paymentData);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

//generate enhanced table for it

const generateEnhancedTable = (doc, data) => {
    const notoSansRegular = path.join(__dirname, "..", "public", "styles", "fonts", "NotoSans-Regular.ttf");
    const headers = data[0];
    const rows = data.slice(1);
    const colWidths = headers.map(() => (doc.page.width - doc.page.margins.left - doc.page.margins.right) / headers.length);

    // Calculate consistent row height
    const rowHeight = 17;

    // Headers
    doc.font(notoSansRegular).fontSize(12);
    let startX = doc.page.margins.left;
    let startY = doc.y;

    headers.forEach((header, i) => {
        doc.text(header, startX, startY, {
            width: colWidths[i],
            align: "center",
            ellipsis: true,
        });
        startX += colWidths[i];
    });

    // Separator line for headers
    startY += rowHeight; // Move below the header row
    doc.moveTo(doc.page.margins.left, startY)
        .lineTo(doc.page.width - doc.page.margins.right, startY)
        .stroke();

    // Data rows
    rows.forEach((row) => {
        startX = doc.page.margins.left;
        startY += rowHeight; // Increment row height

        row.forEach((cell, colIndex) => {
            doc.text(cell.toString(), startX, startY, {
                width: colWidths[colIndex],
                align: "center",
                ellipsis: true,
            });
            startX += colWidths[colIndex];
        });

        // Optional: Add lighter separator lines between rows
        doc.moveTo(doc.page.margins.left, startY + rowHeight - 2)
            .lineTo(doc.page.width - doc.page.margins.right, startY + rowHeight - 2)
            .opacity(0.3)
            .stroke()
            .opacity(1);
    });
};

const generateEnhancedExcelReport = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    // Styling helpers
    const titleStyle = { font: { bold: true, size: 14 }, alignment: { horizontal: "center" } };
    const headerStyle = {
        font: { bold: true },
        alignment: { horizontal: "center" },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCFF" } },
    };
    const currencyFormat = { numFmt: '"₹"#,##0.00' };
    const percentageFormat = { numFmt: "0.00%" };

    // Add Report Title and Date Range
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "Sales Analytics Report";
    sheet.getCell("A1").style = titleStyle;

    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = `Report Type: ${
        reportData.dateRange.reportType.charAt(0).toUpperCase() + reportData.dateRange.reportType.slice(1)
    }`;
    sheet.getCell("A2").style = titleStyle;

    sheet.mergeCells("A3:F3");
    sheet.getCell(
        "A3"
    ).value = `Period: ${reportData.dateRange.start.toLocaleDateString()} to ${reportData.dateRange.end.toLocaleDateString()}`;
    sheet.getCell("A3").style = titleStyle;

    sheet.addRow([]);

    // Add Summary Section
    sheet.addRow(["Executive Summary"]).font = { bold: true, size: 12 };
    const summaryData = [
        ["Metric", "Value"],
        ["Total Orders", reportData.summary.totalOrders],
        ["Net Revenue", reportData.summary.netRevenue],
        ["Average Order Value", reportData.summary.averageOrderValue],
        ["Total Customers", reportData.summary.uniqueCustomerCount],
        ["Revenue per Customer", reportData.summary.revenuePerCustomer],
        ["Discount Rate", reportData.summary.discountRate],
        ["Items per Order", reportData.summary.averageItemsPerOrder],
    ];
    sheet.addRows(summaryData);
    sheet.getRow(sheet.lastRow.number - summaryData.length).eachCell((cell) => (cell.style = headerStyle));
    sheet.columns[2].numFmt = currencyFormat.numFmt;

    sheet.addRow([]);

    // Add Daily Breakdown
    sheet.addRow(["Daily Breakdown"]).font = { bold: true, size: 12 };
    sheet.addRow([
        "Date",
        "Orders",
        "Revenue",
        "Discount",
        "Net Revenue",
        "Shipping",
        "Items Sold",
        "Avg Order Value",
        "Unique Customers",
    ]);
    const dailyBreakdownData = reportData.dailyBreakdown.map((day) => [
        day._id,
        day.orders,
        day.revenue,
        day.discount,
        day.netRevenue,
        day.shipping,
        day.totalItems,
        day.averageOrderValue,
        day.uniqueCustomerCount,
    ]);
    sheet.addRows(dailyBreakdownData);
    sheet.getRow(sheet.lastRow.number - dailyBreakdownData.length - 1).eachCell((cell) => (cell.style = headerStyle));
    sheet.columns.slice(2, 6).forEach((col) => (col.numFmt = currencyFormat.numFmt));
    sheet.columns[7].numFmt = percentageFormat.numFmt;

    sheet.addRow([]);

    // Add Popular Products
    sheet.addRow(["Popular Products"]).font = { bold: true, size: 12 };
    sheet.addRow(["Product", "Total Revenue", "Quantity Sold", "Return Rate", "Customer Count"]);
    const popularProductsData = reportData.popularProducts.map((product) => [
        product.productDetails[0]?.productName || "N/A",
        product.totalRevenue,
        product.totalQuantity,
        product.returnRate,
        product.uniqueCustomerCount,
    ]);
    sheet.addRows(popularProductsData);
    sheet.getRow(sheet.lastRow.number - popularProductsData.length - 1).eachCell((cell) => (cell.style = headerStyle));
    sheet.columns.slice(1, 3).forEach((col) => (col.numFmt = currencyFormat.numFmt));
    sheet.columns[4].numFmt = percentageFormat.numFmt;

    sheet.addRow([]);

    // Add Payment Method Analysis
    sheet.addRow(["Payment Method Analysis"]).font = { bold: true, size: 12 };
    sheet.addRow(["Payment Method", "Count", "Total Amount", "Average Amount", "Success Rate"]);
    const paymentAnalysisData = reportData.paymentAnalysis.map((payment) => [
        payment._id,
        payment.count,
        payment.totalAmount,
        payment.averageAmount,
        payment.successRate,
    ]);
    sheet.addRows(paymentAnalysisData);
    sheet.getRow(sheet.lastRow.number - paymentAnalysisData.length - 1).eachCell((cell) => (cell.style = headerStyle));
    sheet.columns.slice(2, 4).forEach((col) => (col.numFmt = currencyFormat.numFmt));
    sheet.columns[5].numFmt = percentageFormat.numFmt;

    sheet.addRow([]);

    // Add Orders List
    sheet.addRow(["Orders List"]).font = { bold: true, size: 12 };
    sheet.addRow(["Order ID", "Customer Name", "Order Date", "Total Amount", "Payment Type", "Status"]);
    const ordersListData = reportData.orderList.map((order) => [
        order.orderId,
        order.userId?.name || "N/A",
        new Date(order.createdAt).toLocaleDateString(),
        order.totalPrice,
        order.paymentType,
        order.status,
    ]);
    sheet.addRows(ordersListData);
    sheet.getRow(sheet.lastRow.number - ordersListData.length - 1).eachCell((cell) => (cell.style = headerStyle));
    sheet.columns[4].numFmt = currencyFormat.numFmt;

    // Auto-fit columns
    sheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            if (cell.value) {
                const cellValue = cell.value.toString();
                maxLength = Math.max(maxLength, cellValue.length);
            }
        });
        column.width = maxLength + 2;
    });

    // Add Footer
    sheet.addRow([]);
    sheet.addRow(["Generated on:", new Date().toLocaleString()]);
    sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);
    sheet.getCell(`A${sheet.lastRow.number}`).font = { italic: true, size: 10 };
    sheet.getCell(`A${sheet.lastRow.number}`).alignment = { horizontal: "right" };

    // Return as Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

module.exports = {
    loadGeneratorPage,
    generateSalesReport,
};
