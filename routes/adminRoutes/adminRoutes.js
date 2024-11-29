const express = require("express");
const adminRoute = express.Router();
const { adminAuth } = require("../../middlewares/adminAuth");
const adminControllers = require("../../controllers/adminControllers");
const categoryControllers = require("../../controllers/categoryControllers");

//authentication routes

adminRoute.get("/login", adminControllers.loadAdminLogin);
adminRoute.post("/login", adminControllers.postAdminLogin);
adminRoute.get("/dashBoard", adminAuth, adminControllers.loadAdminDashboard);
adminRoute.get("/logout", adminControllers.logout);
adminRoute.get("/errorpage", adminControllers.loadErrorpage);

//user routes

adminRoute.get("/users", adminAuth, adminControllers.userInfo);
adminRoute.get("/users/blockUser", adminAuth, adminControllers.blockUser);
adminRoute.get("/users/unblockUser", adminAuth, adminControllers.unblockUser);

//category routes

// adminRoute.get("/category", adminAuth, categoryControllers.categoryInfo);
// adminRoute.post("/addCategory", adminAuth, categoryControllers.addCategory);
module.exports = adminRoute;
