const express = require("express");
const adminRoute = express.Router();
const { adminAuth } = require("../../middlewares/adminAuth");
const adminControllers = require("../../controllers/adminControllers");
const categoryControllers = require("../../controllers/categoryControllers");
const productControllers = require("../../controllers/productControllers");
const stockControllers = require("../../controllers/stockControllers");
const couponControllers = require("../../controllers/couponControllers");
const salesReportControllers = require("../../controllers/salesReportControllers");
const salesChartControllers = require("../../controllers/salesChartControllers")
const multer = require("multer");

//authentication routes

adminRoute.get("/login", adminControllers.loadAdminLogin);
adminRoute.post("/login", adminControllers.postAdminLogin);
adminRoute.get("/dashBoard", adminAuth, adminControllers.loadAdminDashboard);
adminRoute.get("/logout", adminAuth, adminControllers.logout);
adminRoute.get("/errorpage", adminAuth, adminControllers.loadErrorpage);

//user routes

adminRoute.get("/users", adminAuth, adminControllers.userInfo);
adminRoute.get("/users/blockUser", adminAuth, adminControllers.blockUser);
adminRoute.get("/users/unblockUser", adminAuth, adminControllers.unblockUser);

//category routes

adminRoute.get("/categories", adminAuth, categoryControllers.categoryInfo);
adminRoute.post("/addCategory", adminAuth, categoryControllers.addCategory);
adminRoute.get("/categoryList", adminAuth, categoryControllers.categoryList);
adminRoute.get("/categoryUnlist", adminAuth, categoryControllers.categoryUnlist);
adminRoute.get("/loadUpdateCategory", adminAuth, categoryControllers.loadUpdateCategory);
adminRoute.post("/updateCategory", adminAuth, categoryControllers.updateCategory);
adminRoute.get("/deleteOrUndoCategory", adminAuth, categoryControllers.deleteOrUndoCategory);

//product routes
adminRoute.get("/addProducts", adminAuth, productControllers.loadAddProducts);
adminRoute.post("/addProduct", adminAuth, productControllers.upload.array("images", 5), productControllers.addProducts);
adminRoute.get("/listProducts", adminAuth, productControllers.listProducts);
adminRoute.get("/softDeleteProduct", adminAuth, productControllers.softDelete);
adminRoute.get("/editProducts", adminAuth, productControllers.loadEditProductsPage);
adminRoute.post(
    "/editProduct",
    adminAuth,
    productControllers.editUpload.array("images", 5),
    (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(400).json({
                success: false,
                message: err.message,
            });
        } else if (err) {
            console.error("Upload Error:", err);
            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
        next();
    },
    productControllers.editProduct
);
adminRoute.post("/deleteImg", adminAuth, productControllers.deleteImg);

//inventory routes

adminRoute.get("/listStock", adminAuth, stockControllers.listStocks);
adminRoute.get("/addStock", adminAuth, stockControllers.loadAddStock);
adminRoute.post("/postAddStock", adminAuth, stockControllers.postAddStock);

//oredr routes

adminRoute.get("/listOrders", adminAuth, adminControllers.listOrders);
adminRoute.get("/showDetails/:id", adminAuth, adminControllers.showOrderDetails);
adminRoute.post("/changeOrderStatus", adminAuth, adminControllers.changeOrderStatus);
adminRoute.get("/loadOrderReturnRequests", adminAuth, adminControllers.loadOrderReqs);
adminRoute.post("/order/approveOrReject/:orderId", adminAuth, adminControllers.orderApproveOrReject);
adminRoute.get("/loadItemReturnRequests", adminAuth, adminControllers.loadItemReturnReqs);
adminRoute.post("/order/itemReturnApproveOrReject", adminAuth, adminControllers.itemApproveOrReject);

//coupon routes

adminRoute.get("/loadAddCoupon", adminAuth, couponControllers.loadAddCoupon);
adminRoute.post("/postAddCoupon", adminAuth, couponControllers.postAddCoupon);
adminRoute.get("/listCoupons", adminAuth, couponControllers.listCoupons);
adminRoute.get("/deleteCoupon", adminAuth, couponControllers.deleteCoupon);
adminRoute.get("/couponStatusChange", adminAuth, couponControllers.changeCouponStatus);

//sales report route

adminRoute.get("/loadGenerateSalesReports", adminAuth, salesReportControllers.loadGeneratorPage);
adminRoute.post("/generateSalesReports", adminAuth, salesReportControllers.generateSalesReport);

//get charts

adminRoute.get("/getCharts",adminAuth,salesChartControllers.getChart)

module.exports = adminRoute;
