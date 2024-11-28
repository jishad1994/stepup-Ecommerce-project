const mongoose = require("mongoose");
const User = require("../model/userModel.js");
const bcrypt = require("bcrypt");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const env = require("dotenv").config();

//load home apge
const loadHomePage = async (req, res) => {
    try {
        const user =req.session?.userdata;
        
        res.render("index", {user});
    } catch (err) {
        console.log("error while loading the home page ", err.message);
    }
};

//signuip
const loadSignup = async (req, res) => {
    try {
        res.render("signup");
    } catch (err) {
        console.log("signup page loading error");
        res.status(400).send(`Error while loading signup page: ${err.message}`);
    }
};

//signin
const loadSignin = async (req, res) => {
    try {
        res.render("login");
    } catch (err) {
        console.log("login page loading error");
        res.status(400).send(`Error while loading login page: ${err.message}`);
    }
};

//logout

const logout = async (req, res) => {
    try {
        if (req.session) {
            await req.session.destroy((err) => {
                if (err) {
                    console.error("Error while destroying session:", err);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to logout. Please try again.",
                    });
                }
                console.log("User logout successful");
                return res.redirect("/"); // Redirect after successful logout
            });
        } else {
            console.warn("No active session available to logout.");
            return res.status(400).json({
                success: false,
                message: "No active session available to logout.",
            });
        }
    } catch (error) {
        console.error("Error while logging out:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

//post signup
const signup = async (req, res) => {
    try {
        const { username, password, email, phone } = req.body;
        console.log(req.body);

        const emailTaken = await User.findOne({ email });
        const numberTaken = await User.findOne({ phone });
        if (emailTaken || numberTaken) {
            let errors = {};

            if (emailTaken) {
                errors.email = "Email is already in use";
            }

            if (numberTaken) {
                errors.phone = "Number is already taken";
            }

            return res.status(400).json({
                success: false,
                errors,
            });
        } else {
            // Generate OTP and set expiry
            const OTP = await genOTP();
            const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
            console.log(`The generated OTP is: ${OTP}`);

            // Store OTP and expiry in session
            req.session.userdata = { username, email, password, phone, OTP, expiry };

            // Send the OTP
            await sendOTP(email, OTP);

            return res.status(200).json({
                success: true,
                message: "User email available and OTP sent to email",
            });
        }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//resned otp

const resendOTP = async (req, res) => {
    try {
        const OTP = await genOTP();
        const expiry = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
        console.log(`The generated OTP is: ${OTP}`);

        // Update OTP and expiry in session
        req.session.userdata.OTP = OTP;
        req.session.userdata.expiry = expiry;

        const email = req.session.userdata.email;

        if (!email) {
            console.log("Session has expired and email not found");
            return res.status(400).json({
                success: false,
                message: "Session expired or email not found. Please try again.",
            });
        }

        await sendOTP(email, OTP);
        console.log("OTP has been resent to email");
        return res.status(200).json({
            success: true,
            message: "OTP has been resent to your email.",
        });
    } catch (err) {
        console.log("Error while resending OTP: ", err.message);
        res.status(400).json({
            success: false,
            message: "Failed to resend OTP. Please try again.",
        });
    }
};

const loadOtpPage = async (req, res) => {
    try {
        res.render("otpverification");
    } catch (err) {
        console.log("error while lodaing otp verification page:", err.message);
        res.status(404).json({ success: false, message: "error while loading otp page" });
    }
};

//otp verification page
const verifyOTP = async (req, res) => {
    try {
        console.log("request reached verify otp");
        const { OTP } = req.body;
        console.log(OTP)
        console.log(req.session.userdata)

        if (!req.session.userdata) {
            return res.status(400).json({
                success: false,
                message: "Session expired. Please try again.",
            });
        }

        
        const isExpired = Date.now() >req.session.userdata.expiry;

        if (isExpired) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one.",
            });
        }

        if (OTP == req.session.userdata?.OTP) {
            console.log("OTP matches and verification successful");

            // Clear session OTP after successful verification
            // req.session.userdata.OTP = null;
           
            console.log("the session data is:", req.session.userdata);
            password = req.session.userdata.password;
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = await new User({
                username: req.session.userdata.username,
                email: req.session.userdata.email,
                password: hashedPassword,
                phone: req.session.userdata.phone,
            });

            await user.save();

            return res.status(200).json({
                success: true,
                message: "OTP verification is successful",
            });
        } else {

            console.log("otp else case worked");
            res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            message: "Error while comparing OTP",
        });
    }
};

//post login
const postLogin = async (req, res) => {
    try {
        const { username,email, password } = req.body;
        console.log(req.body)

        // Validate input (you can add custom validation using express-validator)
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required.",
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        let errors = {};
        if (!user) {
            errors.email = "invalid Username";

            return res.status(400).json({
                success: false,
                message: "Invalid login credentials.",
                errors,
            });
        }

        // Compare hashed password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            errors.password = "invalid password";
            return res.status(400).json({
                success: false,
                message: "Invalid login credentials.",
                errors,
            });
        }

        // Successful login
        console.log("User logged in successfully");
        //creating user session
        req.session.userdata = { username ,email};
        return res.status(200).json({
            success: true,
            message: "User logged in successfully",
        });
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred during login. Please try again later.",
        });
    }
};

module.exports = {
    loadSignup,
    loadSignin,
    signup,
    loadOtpPage,
    resendOTP,
    verifyOTP,
    loadHomePage,
    postLogin,
    logout
};
