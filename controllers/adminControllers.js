const { log } = require("winston");
const User = require("../model/userModel");
const bcrypt = require("bcrypt");

const loadAdminLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            console.log("Admin session exists. Redirecting to dashboard...");
            return res.redirect("/admin/dashBoard");
        } else {
            res.render("adminLogin");
        }
    } catch (error) {
        console.error("Error while loading admin login page:", error);
        res.render("404", { message: "Unable to load admin login page. Please try again later." });
    }
};

//post login
const postAdminLogin = async (req, res) => {
    try {
        console.log("post login worked")
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required.",
            });
        }

        // Check if admin exists
        const isAdmin = await User.findOne({ email, isAdmin: true });
        if (!isAdmin) {
            console.log("admin not find condition worked")
            return res.status(400).json({
                success: false,
                message: "Invalid credentials.",
            });
        }

        // Compare password
        const isPasswordMatch = await bcrypt.compare(password, isAdmin.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials.",
            });
        }

        // Save session
        req.session.admin = {
            id: isAdmin._id,
            name: isAdmin.name,
            isLoggedIn: true,
        };

        // Respond with success
        console.log("admin login successfull");
        return res.status(200).json({
            success: true,
            message: "Admin login successful.",
        });
    } catch (error) {
        console.error("Error during admin login:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

//load error page

const loadErrorpage = async (req, res) => {
    res.render("errorpage");
};

//load admin dashbaord
const loadAdminDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            console.log("admis session is:", req.session.admin);
            return res.render("dashBoard");
        } else {
            res.redirect("/admin/login");
        }
    } catch (error) {
        console.log("an error occured while loading dashboard page");
        res.render("404");
    }
};

//logout
const logout = async (req, res) => {
    try {
        await req.session.destroy((err) => {
            if (err) {
                console.error("Error while destroying session:", err);
                return res.redirect("/admin/errorpage");
            }

            console.log("Session destroyed successfully. Logging out user.");
            // Optional: Add a success message to the login page
            res.redirect("/admin/login");
        });
    } catch (error) {
        console.error("Unexpected error during logout:", error);
        res.redirect("/admin/errorpage");
    }
};

///user management
const userInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const search = req.query.search || "";

        const query = {
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        };

        const userData = await User.find(query)
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await User.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        res.render("userInfo", {
            userData,
            currentPage: page,
            totalPages,
            search,
        });
    } catch (error) {
        console.error(error);
        res.status(500).render("error", { error: "An error occurred" });
    }
};

//BLOCK USER

const blockUser = async (req, res) => {
    try {
        console.log("blocking user");
        const id = req.query.id;

        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

        return res.redirect("/admin/users");
    } catch (error) {
        console.log("error while blocking user");
        res.redirect("/admin/errorpage");
    }
};

//UNBLOCK USER

const unblockUser = async (req, res) => {
    try {
        console.log("unblocking user");
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        return res.redirect("/admin/users");
    } catch (error) {
        console.log("error while unblocking user", error);
        res.redirect("/admin/errorpage");
    }
};

module.exports = {
    loadAdminLogin,
    postAdminLogin,
    loadAdminDashboard,
    logout,
    loadErrorpage,
    userInfo,
    blockUser,
    unblockUser,
};
