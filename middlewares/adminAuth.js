const User = require("../model/userModel");
const mongoose = require("mongoose")
//admin authentication
const adminAuth = async (req, res, next) => {
    try {

        console.log("admin session is",req.session)
        const userId = req.session.id;
        const admin = await User.findOne({ isAdmin: true });

        if (!admin) {
            return res.redirect("/admin/login");
        } else {
            console.log("calling next middle ware");
            next(); // Properly invoking the next middleware
        }
    } catch (error) {
        console.log("Error in admin authentication middleware:", error);
        res.status(500).send("Server error. Please try again later.");
    }
};

module.exports = { adminAuth };
