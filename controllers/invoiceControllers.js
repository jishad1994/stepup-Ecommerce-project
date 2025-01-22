const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const Address = require("../model/addressModel.js");
const Wishlist = require("../model/wishlistSchema.js");
const Cart = require("../model/cartSchema.js");
const Order = require("../model/orderModel.js");
const Coupon = require("../model/couponSchema.js");
const Wallet = require("../model/walletModel.js");
const mongoose = require("mongoose");

//generate invoice

const generateInvoice = async (order) => {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `invoice-${order.orderId}.pdf`;

    // font family that supports rupees sign
    const notoSansRegular = path.join(__dirname, "..", "public", "styles", "fonts", "NotoSans-Regular.ttf");

    // Create invoices directory if it doesn't exist
    const invoicesDir = path.join(__dirname, "..", "public", "invoices");
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const filePath = path.join(invoicesDir, fileName);
    doc.pipe(fs.createWriteStream(filePath));

    // Helper functions for consistent styling
    const drawHorizontalLine = (y) => {
        doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
    };

    const formatCurrency = (amount) => {
        return `\u20B9 ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    };

    // Header Section
    doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", 50, 50, { align: "center" });

    doc.fontSize(10).font("Helvetica").text("Invoice No:", 430, 85).font("Helvetica-Bold").text(order.orderId, 490, 85);

    // Company Details (Left Side)
    doc.font("Helvetica-Bold")
        .fontSize(14)
        .text("StepUp", 50, 90)
        .font("Helvetica")
        .fontSize(10)
        .text("FootWare Ecommerce", 50, 110)
        .text("Calicut, Kerala", 50, 125)
        .text("India - 673001", 50, 140)
        .text("GSTIN: 29ABCDE1234F1Z5", 50, 155)
        .text("Phone: +91 1234567890", 50, 170);

    drawHorizontalLine(200);

    // Bill To & Ship To Section
    doc.fontSize(11)
        .font("Helvetica-Bold")
        .text("BILL TO:", 50, 220)
        .font("Helvetica")
        .fontSize(10)
        .text(order.address.fullName, 50, 235)
        .text(order.address.city || "", 50, 250)
        .text(order.address.landMark || "", 50, 250)
        .text(` ${order.address.state} - ${order.address.pincode}`, 50, 265)
        .text(`Phone: ${order.address.phone}`, 50, 280);

    // Invoice Details (Right Side)
    doc.fontSize(10)
        .text("Invoice Date:", 350, 220)
        .text(new Date(order.invoiceDate).toLocaleDateString("en-IN"), 430, 220)
        .text("Payment Method:", 350, 235)
        .text(order.paymentType, 430, 235)
        .text("Payment Status:", 350, 250)
        .text(order.paymentStatus, 430, 250)
        .text("Order Status:", 350, 265)
        .text(order.status, 430, 265);

    drawHorizontalLine(310);

    // Items Table Header
    const tableTop = 340;
    doc.font("Helvetica-Bold")
        .fontSize(10)
        .text("Item", 50, tableTop)
        .text("Description", 150, tableTop)
        .text("Base Price", 250, tableTop)
        .text("GST (%)", 320, tableTop)
        .text("GST Amount", 380, tableTop)
        .text("Qty", 450, tableTop)
        .text("Total Price", 500, tableTop);

    drawHorizontalLine(tableTop + 15);

    // Items Table Content
    let tableY = tableTop + 30;
    doc.font(notoSansRegular);

    for (const item of order.items) {
        doc.fontSize(9)
            .text(item.productId.productName, 50, tableY)
            .text(`Size: ${item.size}`, 150, tableY)
            .text(formatCurrency(item.gstDetails.basePrice), 250, tableY)
            .text(`${item.gstDetails.percentage}%`, 320, tableY)
            .text(formatCurrency(item.gstDetails.gstAmount), 380, tableY)
            .text(item.quantity.toString(), 450, tableY)
            .text(formatCurrency(item.price * item.quantity), 500, tableY);

        if (item.returnRequest.status !== "No Request") {
            tableY += 15;
            doc.fontSize(8).fillColor("red").text(`Return: ${item.returnRequest.status}`, 150, tableY).fillColor("black");
        }

        tableY += 25;
    }

    drawHorizontalLine(tableY);

    const gstTotals = order.items.reduce(
        (totals, item) => {
            totals.totalBasePrice += item.gstDetails.basePrice * item.quantity;
            totals.totalGstAmount += item.gstDetails.gstAmount * item.quantity;
            return totals;
        },
        { totalBasePrice: 0, totalGstAmount: 0 }
    );

    // Summary Section
    // tableY += 20;
    // doc.fontSize(10)
    //     .font(notoSansRegular)
    //     .text("Subtotal:", 350, tableY)
    //     .text(formatCurrency(order.totalPrice - order.shippingFee), 480, tableY);

    // tableY += 20;
    // doc.text("Shipping Fee:", 350, tableY).text(formatCurrency(order.shippingFee), 480, tableY);

    // if (order.couponApplied) {
    //     tableY += 20;
    //     doc.text("Discount:", 350, tableY).text(` -${formatCurrency(order.couponDetails.discountAmount)}`, 480, tableY);
    // }

    // drawHorizontalLine(tableY + 15);

    // tableY += 30;
    // doc.fontSize(12)
    //     .font(notoSansRegular)
    //     .text("Total: ₹", 350, tableY)
    //     .text(formatCurrency(order.totalPrice), 480, tableY);

    // Summary Section
    tableY += 20;
    doc.fontSize(10).text("Total Base Price:", 350, tableY).text(formatCurrency(gstTotals.totalBasePrice), 480, tableY);

    tableY += 20;
    doc.text("Total GST Amount:", 350, tableY).text(formatCurrency(gstTotals.totalGstAmount), 480, tableY);

    tableY += 20;
    doc.text("Subtotal (Incl. GST):", 350, tableY).text(formatCurrency(order.totalPrice - order.shippingFee), 480, tableY);

    tableY += 20;
    doc.text("Shipping Fee:", 350, tableY).text(formatCurrency(order.shippingFee), 480, tableY);

    if (order.couponApplied) {
        tableY += 20;
        doc.text("Discount:", 350, tableY).text(` -${formatCurrency(order.couponDetails.discountAmount)}`, 480, tableY);
    }

    drawHorizontalLine(tableY + 15);

    tableY += 30;
    doc.fontSize(12).text("Total Amount:", 350, tableY).text(formatCurrency(order.totalPrice), 480, tableY);

    // Footer Section
    const footerTop = doc.page.height - 100;
    drawHorizontalLine(footerTop);

    doc.fontSize(8)
        .font("Helvetica")
        .text("Terms & Conditions:", 50, footerTop + 10)
        .text("1. Returns accepted within 7 days of delivery", 50, footerTop + 25)
        .text("2. Original invoice must be presented for returns", 50, footerTop + 35)
        .text("3. Damaged items must be reported within 24 hours of delivery", 50, footerTop + 45);

    // Page Numbers
    const pages = doc.bufferedPageRange();
    for (let i = 2; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 50, { align: "center" });
    }

    doc.end();
    return fileName;
};

const downloadInvoice = async (req, res) => {
    let filePath = null;

    try {
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid order ID format",
            });
        }

        // Find and populate order with necessary data
        const order = await Order.findById(req.params._id).populate("userId").populate("items.productId").lean();
        console.log("order is", order);

        if (!order) {
            return res.status(404).json({
                status: "error",
                message: "Order not found",
            });
        }

        // Generate invoice
        const fileName = await generateInvoice(order);

        console.log("file name is", fileName);
        filePath = path.join(__dirname, "..", "public", "invoices", fileName);
        console.log("file path is", filePath);
        // Verify file exists before attempting download
        if (!fs.existsSync(filePath)) {
            throw new Error("Generated invoice file not found");
        }

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

        // Stream the file instead of loading it entirely into memory
        const fileStream = fs.createReadStream(filePath);

        fileStream.on("error", (error) => {
            console.error("Error streaming invoice file:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    status: "error",
                    message: "Error streaming invoice file",
                });
            }
        });

        fileStream.on("end", () => {
            // Clean up: Delete file after successful download
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error("Error deleting invoice file:", err);
                }
            });
        });

        // Pipe the file stream to response
        fileStream.pipe(res);
    } catch (error) {
        console.error("Invoice download error:", error);

        // Clean up: Delete file if it was created but error occurred
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkError) {
                console.error("Error deleting invoice file after error:", unlinkError);
            }
        }

        // Send appropriate error response
        if (!res.headersSent) {
            res.status(500).json({
                status: "error",
                message: "Error processing invoice download",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
};

module.exports = { downloadInvoice };
