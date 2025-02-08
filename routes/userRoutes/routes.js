const express = require("express");
const route = express.Router();
const userController = require("C:/Users/Jishad/Desktop/stepUp/controllers/userControllers.js");
// const userAuth = require("C:/Users/Jishad/Desktop/stepUp/middlewares/userAuth.js");
const { fetchIsUserAuthenticated, isUserAuthenticated: userAuth } = require("../../middlewares/userAuth");
const passport = require("../../config/passport");
const env = require("dotenv").config();
const cartControllers = require("../../controllers/userCartControllers");
const passwordControllers = require("../../controllers/passwordControllers");
const wishlistControllers = require("../../controllers/wishlistControllers");
const checkoutControllers = require("../../controllers/checkoutControllers");
const addressControllers = require("../../controllers/addressControllers");
const orderControllers = require("../../controllers/orderControllers");
const productControllers = require("../../controllers/productControllers");
const paymentControllers = require("../../controllers/paymentControllers");
const invoiceControllers = require("../../controllers/invoiceControllers");

route.use((req, res, next) => {
    console.log(` request type: ${req.method} | request url:${req.url} `);
    next();
});

//RAZORPAY ROUTES
route.post("/rzpCreateOrder", userAuth, checkoutControllers.rzpCreateOrder);
route.post("/rzpVerifyPayment", userAuth, checkoutControllers.rzpVerifyPayment);

//razorpay repayment
route.post("/reTryRzpCreateOrder", userAuth, paymentControllers.reTryRzpCreateOrder);
route.post("/reTryRzpVerifyPayment", userAuth, paymentControllers.reTryRzpVerifyPayment);

//authentication controllers
route.get("/", userController.loadHomePage);
route.get("/signup", userController.loadSignup);
route.post("/signup", userController.signup);
route.get("/login", userController.loadSignin);
route.post("/login", userController.postLogin);
route.get("/logout", userAuth, userController.logout);

route.get("/signup/verifyOTP", userController.loadOtpPage);
route.post("/signup/verifyOTP", userController.verifyOTP);
route.post("/signup/resendOTP", userController.resendOTP);

//user profile controllers

route.get("/userprofile", userAuth, userController.userProfile);
route.get("/loadProfileEdit", userAuth, userController.loadEditProfile);
route.put("/postEditProfile", userAuth, userController.postEditProfile);

//product controllers
route.get("/shopall", userController.loadShopAll);
route.get("/product/:id", userController.loadProduct);

//cart controllers
route.get("/cart", userAuth, cartControllers.loadCartPage);
route.post("/addToCart", fetchIsUserAuthenticated, cartControllers.addToCart);
route.get("/removeFromCart", userAuth, cartControllers.removeFromCart);
route.post("/updateCart", userAuth, cartControllers.updateCart);

//address routes
route.post("/addAddress", userAuth, addressControllers.addAddress);
route.get("/addresses", userAuth, addressControllers.addresses);
route.delete("/deleteAddress/:id", userAuth, addressControllers.deleteAddress);
route.post("/editAddress/:id", userAuth, addressControllers.postEditAddress);
route.get("/editAddress/:id", userAuth, addressControllers.loadEditAddress);
route.get("/addAddress", userAuth, addressControllers.loadAddAddress);

// reset password routes
route.get("/passwordReset", passwordControllers.loadPasswordResetPage);
route.post("/passwordReset", passwordControllers.verifyEmail);
route.get("/verifyResetPasswordOTP", passwordControllers.loadResetPasswordVerificationPage);
route.post("/verifyResetPasswordOTP", passwordControllers.verifyResetPasswordOTP);
route.get("/resetPasswordFinal", passwordControllers.loadResetPasswordFinalPage);
route.post("/resetPasswordFinal", passwordControllers.resetPassword);
route.post("/passwordResetResendOTP", passwordControllers.passwordResetResendOTP);

//wishlist routes

route.get("/wishlist", userAuth, wishlistControllers.loadWishlist);
route.post("/addToWishlist", fetchIsUserAuthenticated, wishlistControllers.addToWishlist);
route.delete("/deleteWishlist", fetchIsUserAuthenticated, wishlistControllers.deleteWishlist);

//checkout routes
route.post("/applyCoupon", userAuth, checkoutControllers.applyCoupon);
route.get("/checkout", userAuth, checkoutControllers.loadCheckout);
route.post("/placeOrder", userAuth, checkoutControllers.placeOrder);

//order routes
route.get("/cancelOrder/:id", userAuth, orderControllers.cancelOrder);
route.get("/showDetails/:id", userAuth, orderControllers.showDetails);
route.get("/orders", userAuth, orderControllers.loadOrders);
route.get("/orderConfirmation", userAuth, userController.orderConfirmed);
route.post("/cancelSingleItem", userAuth, orderControllers.cancelSingleItem);
route.post("/returnOrder", userAuth, orderControllers.returnOrder);
route.post("/returnItem", userAuth, orderControllers.returnItem);

//load successpage after order oplacement
route.get("/loadSuccessPage/:_id", userAuth, orderControllers.loadSuccessPage);

//download Invoice
route.get("/downloadInvoice/:_id", userAuth, invoiceControllers.downloadInvoice);

//wallet controllers
route.get("/wallet", userAuth, userController.wallet);
route.post("/placeOrderByWallet", userAuth, checkoutControllers.placeOrderByWallet);

//stock availabity check route

route.post("/checkQuantity", userAuth, productControllers.checkStock);

//google auth routes
route.get("/signup/googleAuth", passport.authenticate("google", { scope: ["profile", "email"] }));
route.get(
    "/signup/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    (req, res) => {
        console.log("Authentication successful, user:", req.user);

        // Extract JWT token
        const { user, token } = req.user;

        // Store token in a secure cookie
        res.cookie("authToken", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 2 * 60 * 60 * 1000, // 2 hours
        });

        // Store user in session
        req.session.userdata = { name: user.name, email: user.email };
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).json({ message: "Session error" });
            }
            res.redirect("/"); // Redirect after login
        });
    }
);


module.exports = route;
