const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const SalesReportPDFGenerator = require("../helpers/salesReportPdfGenerator");

//generate pdf report
const generatePDFReport2 = async (reportData) => {
    // const pdfGenerator = new SalesReportPDFGenerator(reportData);
    // return await pdfGenerator.generatePDF();
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            // Add report header
            doc.fontSize(20).text("Sales Report", { align: "center" });
            doc.moveDown();
            doc.fontSize(12).text(
                `Period: ${reportData.dateRange.start.toLocaleDateString()} to ${reportData.dateRange.end.toLocaleDateString()}`
            );
            doc.moveDown();
            // Add summary section
            doc.fontSize(16).text("Summary");
            doc.fontSize(12)
                .text(`Total Orders: ${reportData.summary.totalOrders}`)
                .text(`Total Sales: ₹ ${reportData.summary.totalSales.toFixed(2)}`)
                .text(`Total Shipping: ₹ ${reportData.summary.totalShipping.toFixed(2)}`)
                .text(`Orders with Discount: ${reportData.summary.discountedOrders}`)
                .text(`Total Discount Amount: ₹ ${reportData.summary.totalDiscount.toFixed(2)}`);
            doc.moveDown();
            // Add daily breakdown
            doc.fontSize(16).text("Daily Breakdown");
            reportData.dailyBreakdown.forEach((day) => {
                doc.fontSize(12).text(
                    `${day._id}: Orders - ${day.orders}, Revenue - ₹ ${day.revenue.toFixed(
                        2
                    )}, Discount - ₹ ${day.discount.toFixed(2)}`
                );
            });
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

const generatePDFReport1 = async (reportData) => {
    return new Promise((res, rej) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            let buffers = [];
            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {});

            // Title
            doc.fontSize(18).text("Sales Report", { align: "center" }).moveDown(2);

            // Summary Section
            doc.fontSize(14).text("Summary", { underline: true }).moveDown(0.5);
            doc.fontSize(12);
            const summary = reportData.summary;
            doc.text(`Total Orders: ${summary.totalOrders}`);
            doc.text(`Total Sales: ₹ ${summary.totalSales.toFixed(2)}`);
            doc.text(`Total Shipping: ₹ ${summary.totalShipping.toFixed(2)}`);
            doc.text(`Orders with Discount: ${summary.discountedOrders}`);
            doc.text(`Total Discount Amount: ₹ ${summary.totalDiscount.toFixed(2)}`).moveDown(1);

            // Daily Breakdown Section
            doc.fontSize(14).text("Daily Breakdown", { underline: true }).moveDown(0.5);
            const dailyBreakdown = reportData.dailyBreakdown;
            const dailyTableHeader = ["Date", "Orders", "Revenue", "Discount"];
            const dailyTableRows = dailyBreakdown.map((item) => [
                item._id,
                item.orders,
                `$${item.revenue.toFixed(2)}`,
                `$${item.discount.toFixed(2)}`,
            ]);
            generateTable(doc, dailyTableHeader, dailyTableRows);

            // Popular Products Section
            doc.addPage().fontSize(14).text("Popular Products", { underline: true }).moveDown(0.5);
            const popularProducts = reportData.popularProducts;
            const productTableHeader = ["Product", "Quantity Sold", "Revenue"];
            const productTableRows = popularProducts.map((item) => [
                item.productDetails[0].name,
                item.totalQuantity,
                `₹${item.totalRevenue.toFixed(2)}`,
            ]);
            generateTable(doc, productTableHeader, productTableRows);

            // Finalize the PDF
            doc.end();
            // return Buffer.concat(buffers);
        } catch (error) {
            rej(error);
        }
    });
};

// Function to generate tables
// const generateTable = (doc, headers, rows) => {
//     const tableTop = doc.y;
//     const columnWidth = doc.page.width / headers.length;

//     // Header
//     doc.fontSize(12).font("Helvetica-Bold");
//     headers.forEach((header, i) => {
//         doc.text(header, columnWidth * i + 50, tableTop, {
//             width: columnWidth - 10,
//             align: "center",
//         });
//     });
//     doc.moveDown(0.5);

//     // Rows
//     doc.font("Helvetica");
//     rows.forEach((row, rowIndex) => {
//         row.forEach((cell, i) => {
//             doc.text(cell, columnWidth * i + 50, tableTop + (rowIndex + 1) * 20, {
//                 width: columnWidth - 10,
//                 align: "center",
//             });
//         });
//     });

//     doc.moveDown(1);
// };

//generate excel report
const generateExcelReport = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Add header
    worksheet.addRow(["Sales Report"]);
    worksheet.addRow([
        `Period: ${reportData.dateRange.start.toLocaleDateString()} to ${reportData.dateRange.end.toLocaleDateString()}`,
    ]);
    worksheet.addRow([]);

    // Add summary
    worksheet.addRow(["Summary"]);
    worksheet.addRow(["Total Orders", reportData.summary.totalOrders]);
    worksheet.addRow(["Total Sales", reportData.summary.totalSales]);
    worksheet.addRow(["Total Shipping", reportData.summary.totalShipping]);
    worksheet.addRow(["Orders with Discount", reportData.summary.discountedOrders]);
    worksheet.addRow(["Total Discount Amount", reportData.summary.totalDiscount]);
    worksheet.addRow([]);

    // Add daily breakdown
    worksheet.addRow(["Daily Breakdown"]);
    worksheet.addRow(["Date", "Orders", "Revenue", "Discount"]);
    reportData.dailyBreakdown.forEach((day) => {
        worksheet.addRow([day._id, day.orders, day.revenue, day.discount]);
    });

    return await workbook.xlsx.writeBuffer();
};

const generatePDFReport = (reportData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));

            // Title
            doc.fontSize(20).text("Sales Report", { align: "center" }).moveDown(1);

            // Date Range
            doc.fontSize(12)
                .text(
                    `Period: ${reportData.dateRange.start.toLocaleDateString()} to ${reportData.dateRange.end.toLocaleDateString()}`,
                    { align: "center" }
                )
                .moveDown(2);

            // Summary Section
            doc.fontSize(16).text("Summary", { underline: true }).moveDown(0.5);
            const summaryData = [
                ["Total Orders", reportData.summary.totalOrders],
                ["Total Sales", `$${reportData.summary.totalSales.toFixed(2)}`],
                ["Total Shipping", `$${reportData.summary.totalShipping.toFixed(2)}`],
                ["Orders with Discount", reportData.summary.discountedOrders],
                ["Total Discount Amount", `$${reportData.summary.totalDiscount.toFixed(2)}`],
            ];
            generateTable(doc, summaryData, ["Metric", "Value"]);

            // Daily Breakdown Section
            doc.moveDown(1).fontSize(16).text("Daily Breakdown", { underline: true }).moveDown(0.5);
            const dailyBreakdownRows = reportData.dailyBreakdown.map((day) => [
                day._id,
                day.orders,
                `$${day.revenue.toFixed(2)}`,
                `$${day.discount.toFixed(2)}`,
            ]);
            generateTable(doc, dailyBreakdownRows, ["Date", "Orders", "Revenue", "Discount"]);

            // Popular Products Section
            doc.addPage().fontSize(16).text("Popular Products", { underline: true }).moveDown(0.5);
            const popularProductsRows = reportData.popularProducts.map((product) => [
                product.productDetails[0]?.productName || "N/A",
                product.totalQuantity,
                `₹${product.totalRevenue.toFixed(2)}`,
            ]);
            generateTable(doc, popularProductsRows, ["Product", "Quantity Sold", "Revenue"]);

            // Finalize PDF
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// Utility Function to Generate Tables
const generateTable = (doc, rows, headers) => {
    const startY = doc.y;
    const columnCount = headers.length;
    const columnWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columnCount;

    // Draw Header Row
    doc.font("Helvetica-Bold").fontSize(12);
    headers.forEach((header, index) => {
        doc.text(header, doc.page.margins.left + index * columnWidth, startY, {
            width: columnWidth,
            align: "center",
        });
    });

    // Draw a line below headers
    doc.moveTo(doc.page.margins.left, startY + 15)
        .lineTo(doc.page.width - doc.page.margins.right, startY + 15)
        .stroke();

    // Draw Data Rows
    doc.font("Helvetica").fontSize(11).moveDown(0.5);
    rows.forEach((row, rowIndex) => {
        row.forEach((cell, index) => {
            doc.text(cell, doc.page.margins.left + index * columnWidth, startY + 25 + rowIndex * 20, {
                width: columnWidth,
                align: "center",
            });
        });
    });

    doc.moveDown(1);
};

module.exports = {
    generatePDFReport,
    generateExcelReport,
};
