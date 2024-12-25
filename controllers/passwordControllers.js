const User = require("../model/userModel");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

const loadPasswordResetPage = async (req, res) => {
    try {
        res.render("forgotPassword");
    } catch (error) {}
};

//verify Email

const verifyEmail = async (req, res) => {
    try {
        const { email } = req.body;

        //find user from Db

        const user = await User.findOne({ email });

        //if no user found send status

        if (!user) {
            console.log("no user found in DB");
            return res.status(400).json({ success: false, message: "No User Found " });
        }

        if (user.isBlocked) {
            console.log("User is Blocked");
            return res.status(400).json({ success: false, message: "Your account is blocked. Please contact support." });
        }

        //if everythink is ok send OTP and redirect to OTP verification page

        const OTP = await genOTP();
        await sendOTP(email, OTP);
        const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
        req.session.userData = { email, OTP, expiry };
        console.log(`the password raset OTP is ${OTP}`);

        res.status(200).json({ success: true, message: "An Verification OTP Is Sent" });
    } catch (error) {
        console.log("internal server error while verifying forgot password email");
        res.status(500).json({ success: false, message: "internal server Error" });
    }
};

//OTP verification page

const loadResetPasswordVerificationPage = async (req, res) => {
    try {
        res.render("resetPasswordOTPVerificationPage");
    } catch (error) {}
};

//verify OTP

const verifyResetPasswordOTP = async (req, res) => {
    try {
        //deconstruct otp and expiry time
        const OTPrecieved = req.body.OTP;
        //deconstruct original otp and expiry time and email from session
        const { email, OTP, expiry } = req.session.userData;

        if (!OTPrecieved) {
            console.log("no otp input recieved");
            res.status(400).json({ success: false, message: "please enter a valid otp" });
        }

        if (OTPrecieved != OTP) {
            console.log("invalid otp recieved");
            res.status(400).json({ success: false, message: "Invalid OTP" });
        }
        if (OTPrecieved === OTP && Date.now() > expiry) {
            console.log("OTP expired");
            res.status(400).json({ success: false, message: "OTP expired, Resend OTP" });
        }

        if (OTPrecieved === OTP && Date.now() < expiry) {
            req.session.userData.OTP = null; //make the session otp value null for future use
            console.log("OTP verification success full");
            res.status(200).json({ success: true, message: "OTP verification successfull" });
        }
    } catch (error) {
        console.log("internal server error");
        res.status(500).json({ success: false, message: "Internal server Error" });
    }
};

// load change password page

const loadResetPasswordFinalPage = async (req, res) => {
    try {
        const { email } = req.session.userData;
        res.render("resetPassword");
    } catch (error) {
        console.log(error.message);
        res.render("404");
    }
};

//reset password controller
const resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        const formData = {
            password,
            confirmPassword,
        };
        // Validate formData presence
        if (Object.keys(formData)<=0) {
            console.log("Missing form data");
            return res.status(400).json({ success: false, message: "Invalid request data" });
        }

        // Validate passwords
        if (!password || !confirmPassword) {
            console.log("Password or confirmPassword is missing");
            return res.status(400).json({ success: false, message: "Please enter valid passwords" });
        }

        if (password !== confirmPassword) {
            console.log("Passwords do not match");
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        // Fetch the user from the database
        const email = req.session?.userData?.email; // Safely access session data
        if (!email) {
            console.log("User email not found in session");
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();

        console.log("Password reset successfully");
        return res.status(200).json({ success: true, message: "Password reset successful" });
    } catch (error) {
        console.error("Internal Server Error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//resendotp logic

const passwordResetResendOTP = async (req, res) => {
    try {
        const OTP = await genOTP();
        const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
        console.log(`The generated OTP is: ${OTP}`);

        // Update OTP and expiry in session
        req.session.userData.OTP = OTP;
        req.session.userData.expiry = expiry;

        const email = req.session.userData.email;

        if (!email) {
            console.log("Session has expired and email not found");
            return res.status(400).json({
                success: false,
                message: "Session expired or email not found. Please try again.",
            });
        }

        await sendOTP(email, OTP);
        console.log("OTP has been resent,new OTP :", OTP);
        return res.status(200).json({
            success: true,
            message: "OTP has been resent to your email.",
        });
    } catch (err) {
        console.log("Error while resending OTP: ", err.message);
        res.status(400).json({
            success: false,
            message: "Failed to resend OTP. internal Server Error.",
        });
    }
};

module.exports = {
    loadPasswordResetPage,
    verifyEmail,
    loadResetPasswordVerificationPage,
    verifyResetPasswordOTP,
    loadResetPasswordFinalPage,
    resetPassword,
    passwordResetResendOTP,
};
