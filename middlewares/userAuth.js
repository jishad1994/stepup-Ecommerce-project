const User = require("../model/userModel");

// Middleware to restrict access to authenticated users only
const isUserAuthenticated = async (req, res, next) => {
    try {
        const email = req.session?.userdata?.email;

        if (email) {
            // Find user in the database
            const user = await User.findOne({ email });

            if (!user) {
                console.error("User not found in the database.");
                return res.redirect("/login"); // Redirect if user does not exist
            }

            if (user.isBlocked) {
                
                console.warn("Blocked user tried to access the site.");
                return res.render("login"); // Redirect if user is blocked
            }

            // User is authenticated and not blocked
            return next();
        } else {
            console.warn("Unauthenticated user tried to access a protected route.");
            return res.redirect("/login"); // Redirect if no session is found
        }
    } catch (error) {
        console.error("Error in authentication middleware:", error.message);
        return res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

// Middleware to restrict logged-in users from accessing login/signup pages
const isLoggedIn = async (req, res, next) => {
    try {
        if (req.session?.userdata) {
            console.info("Redirecting logged-in user to home page.");
            return res.redirect("/");
        }
        next();
    } catch (error) {
        console.error("Error in login-check middleware:", error.message);
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
};

module.exports = {
    isLoggedIn,
    isUserAuthenticated,
};
