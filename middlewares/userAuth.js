const User = require("../model/userModel");
const jwt = require("jsonwebtoken");

const isUserAuthenticated = async (req, res, next) => {
    try {
        // Extract the token from the cookie
        const token = req.cookies.authToken;
        if (!token) {
            console.warn("No auth token found, user unauthenticated.");
            return res.redirect("/login");
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            console.error("User not found in the database.");
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        // Check if the user is blocked
        if (user.isBlocked) {
            console.warn("Blocked user tried to access the site.");
            return res.status(403).json({ success: false, message: "Account is blocked." });
        }

        // Attach user information to the request object
        req.user = user;
        user.token = token;
        // Proceed to the next middleware
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            console.warn("Token has expired.");
            return res.status(401).json({ success: false, message: "Token expired. Please login again." });
        }
        if (error.name === "JsonWebTokenError") {
            console.warn("Invalid token provided.");
            return res.status(401).json({ success: false, message: "Invalid token." });
        }
        console.error("Error in authentication middleware:", error.message);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

//
const fetchIsUserAuthenticated = async (req, res, next) => {
    try {
        // Extract the token from the cookie
        const token = req.cookies.authToken;
        if (!token) {
            console.warn("No auth token found, user unauthenticated.");
            return res.status(500).json({ success: false ,message:"No auth token found, user unauthenticated"});
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            console.error("User not found in the database.");
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        // Check if the user is blocked
        if (user.isBlocked) {
            console.warn("Blocked user tried to access the site.");
            return res.status(403).json({ success: false, message: "Account is blocked." });
        }

        // Attach user information to the request object
        req.user = user;
        user.token = token;
        // Proceed to the next middleware
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            console.warn("Token has expired.");
            return res.status(401).json({ success: false, message: "Token expired. Please login again." });
        }
        if (error.name === "JsonWebTokenError") {
            console.warn("Invalid token provided.");
            return res.status(401).json({ success: false, message: "Invalid token." });
        }
        console.error("Error in authentication middleware:", error.message);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

module.exports = { isUserAuthenticated, fetchIsUserAuthenticated };
