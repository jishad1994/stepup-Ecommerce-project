const express = require("express");
const route = express.Router();
const userController = require("C:/Users/Jishad/Desktop/stepUp/controllers/userControllers.js");
const userAuth = require("C:/Users/Jishad/Desktop/stepUp/middlewares/userAuth.js");
const passport = require("../../config/passport");
const env = require("dotenv");
const cartControllers = require("../../controllers/userCartControllers");
const passwordControllers = require("../../controllers/passwordControllers");
const wishlistControllers = require("../../controllers/wishlistControllers");
const checkoutControllers = require("../../controllers/checkoutControllers");
const addressControllers = require("../../controllers/addressControllers");
const orderControllers = require("../../controllers/orderControllers");
const productControllers = require("../../controllers/productControllers")

route.use((req, res, next) => {
    console.log(` request type: ${req.method} | request url:${req.url} `);
    next();
});

//RAZORPAY ROUTES   
route.post("/rzpCreateOrder",userAuth,checkoutControllers.rzpCreateOrder)
route.post("/rzpVerifyPayment",userAuth,checkoutControllers.rzpVerifyPayment)


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
route.get("/shopall/:id", userController.shopCategory);
route.get("/shopall", userController.loadShopAll);
route.get("/product/:id", userController.loadProduct);

//cart controllers
route.get("/cart", userAuth, cartControllers.loadCartPage);
route.post("/addToCart", userAuth, cartControllers.addToCart);
route.get("/removeFromCart", userAuth, cartControllers.removeFromCart);

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
route.post("/addToWishlist", userAuth, wishlistControllers.addToWishlist);
route.delete("/deleteWishlist", userAuth, wishlistControllers.deleteWishlist);

//checkout routes

route.get("/checkout", userAuth, checkoutControllers.loadCheckout);
route.post("/placeOrder", userAuth, checkoutControllers.placeOrder);

//order routes
route.get("/cancelOrder/:id", userAuth, orderControllers.cancelOrder);
route.get("/showDetails/:id", userAuth, orderControllers.showDetails);
route.get("/orders", userAuth, orderControllers.loadOrders);
route.get("/orderConfirmation", userAuth, userController.orderConfirmed);

//wallet controllers
route.get("/wallet", userAuth, userController.wallet);


//stock availabity check route

route.post("/checkQuantity",userAuth,productControllers.checkStock)

//google auth routes
route.get("/signup/googleAuth", passport.authenticate("google", { scope: ["profile", "email"] }));
route.get(
    "/signup/google/callback",
    passport.authenticate("google", { successRedirect: "/", failureRedirect: "/signup", prompt: "select_account" }),
    (req, res) => {
        console.log("Authentication successful, user:", req.user);

        // Use data from req.user instead of req.body
        const { name, email } = req.user;

        console.log(`the req.user recieved from google auth is: ${req.user}`);
        // Store authenticated user data in session
        req.session.userdata = { name, email };
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session:", err);
            }
        });
    }
);

module.exports = route;
