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

    // Create invoices directory if it doesn't exist
    const invoicesDir = path.join(__dirname, "..", "public", "invoices");
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const filePath = path.join(invoicesDir, fileName);
    doc.pipe(fs.createWriteStream(filePath));

    // Header
    doc.fontSize(20).text("INVOICE", { align: "center" });
    doc.moveDown();

    // Company Info
    doc.fontSize(12);
    doc.text("ShoeStore.com", { align: "right" });
    doc.text("123 Street, City", { align: "right" });
    doc.text("Phone: 1234567890", { align: "right" });
    doc.moveDown();

    // Order Details
    doc.fontSize(12);
    doc.text(`Invoice Date: ${new Date(order.invoiceDate).toLocaleDateString()}`);
    doc.text(`Order ID: ${order.orderId}`);
    doc.text(`Payment Method: ${order.paymentType}`);
    doc.moveDown();

    // Shipping Address
    doc.text("Shipping Address:");
    doc.text(order.address.fullName);
    doc.text(order.address.landMark || "");
    doc.text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`);
    doc.text(`Phone: ${order.address.phone}`);
    doc.moveDown();

    // Items Table
    const tableTop = doc.y;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 400;
    const amountX = 450;

    doc.font("Helvetica-Bold");
    doc.text("Item", itemCodeX, tableTop);
    doc.text("Description", descriptionX, tableTop);
    doc.text("Qty", quantityX, tableTop);
    doc.text("Price", priceX, tableTop);
    doc.text("Amount", amountX, tableTop);

    let tableY = tableTop + 20;
    doc.font("Helvetica");

    for (const item of order.items) {
        doc.text(item.productId.toString(), itemCodeX, tableY);
        doc.text(`Size: ${item.size}`, descriptionX, tableY);
        doc.text(item.quantity.toString(), quantityX, tableY);
        doc.text(`₹ ${item.price}`, priceX, tableY);
        doc.text(`₹ ${item.price * item.quantity}`, amountX, tableY);
        tableY += 20;
    }

    doc.moveDown();
    tableY += 20;

    // Summary
    doc.text("Subtotal:", 350, tableY);
    doc.text(`₹${order.totalPrice - order.shippingFee}`, 450, tableY);

    tableY += 20;
    doc.text("Shipping:", 350, tableY);
    doc.text(`₹${order.shippingFee}`, 450, tableY);

    if (order.couponApplied) {
        tableY += 20;
        doc.text("Discount:", 350, tableY);
        doc.text(`-₹${order.couponDetails.discountAmount}`, 450, tableY);
    }

    tableY += 20;
    doc.font("Helvetica-Bold");
    doc.text("Total:", 350, tableY);
    doc.text(`₹${order.totalPrice}`, 450, tableY);

    // Footer
    doc.font("Helvetica");
    doc.moveDown();
    doc.text("Thank you for shopping with us!", { align: "center" });

    doc.end();

    return fileName;
};

// Express route handler
const downloadInvoice = async (req, res) => {
    try {
        const _id = new mongoose.Types.ObjectId(req.params._id);
        const order = await Order.findById(_id).populate("userId");

        console.log(order);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const fileName = await generateInvoice(order);
        const filePath = path.join(__dirname, "..", "public", "invoices", fileName);
        
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.log(err);
                res.status(500).json({ message: "Error downloading invoice" });
            }
            // Delete file after download
            // fs.unlink(filePath, (err) => {
            //     console.log(err);
            //     if (err) console.error("Error deleting invoice file:", err);
            // });
        });
    } catch (error) {
        res.status(500).json({ message: "Error generating invoice" });
    }
};

module.exports = { downloadInvoice };
