const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

//generate pdf report
const generatePDFReport = async (reportData) => {
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
                .text(`Total Sales: $${reportData.summary.totalSales.toFixed(2)}`)
                .text(`Total Shipping: $${reportData.summary.totalShipping.toFixed(2)}`)
                .text(`Orders with Discount: ${reportData.summary.discountedOrders}`)
                .text(`Total Discount Amount: $${reportData.summary.totalDiscount.toFixed(2)}`);

            doc.moveDown();

            // Add daily breakdown
            doc.fontSize(16).text("Daily Breakdown");
            reportData.dailyBreakdown.forEach((day) => {
                doc.fontSize(12).text(
                    `${day._id}: Orders - ${day.orders}, Revenue - $${day.revenue.toFixed(
                        2
                    )}, Discount - $${day.discount.toFixed(2)}`
                );
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

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

module.exports = {
    generatePDFReport,
    generateExcelReport,
};
