const express = require("express");
const route = express.Router();
const userController = require("C:/Users/Jishad/Desktop/stepUp/controllers/userControllers.js");
const userAuth= require("C:/Users/Jishad/Desktop/stepUp/middlewares/userAuth.js");
const passport = require("../../config/passport");
const env = require("dotenv");

route.use((req, res, next) => {
    console.log(` request type: ${req.method} | request url:${req.url} `);
    next();
});
route.get("/", userController.loadHomePage);
route.get("/signup", userController.loadSignup);
route.post("/signup", userController.signup);
route.get("/login",userController.loadSignin);
route.post("/login", userController.postLogin);
route.get("/logout",userAuth, userController.logout);
route.get("/shopall",userAuth, userController.loadShopAll);
route.get("/cart",userAuth, userController.loadCart);
route.get("/wallet",userAuth, userController.wallet);
route.get("/product/:id",userAuth, userController.loadProduct);
route.get("/wishlist",userAuth, userController.loadWishlist);
route.get("/checkout", userAuth,userController.loadCheckOut);
route.get("/addAddress",userAuth, userController.addAddress);
route.get("/addresses",userAuth, userController.addresses);
route.get("/orders",userAuth, userController.orders);
route.get("/userprofile",userAuth, userController.userProfile);
route.get("/orderConfirmation",userAuth, userController.orderConfirmed);
route.get("/signup/verifyOTP",userAuth, userController.loadOtpPage);
route.post("/signup/verifyOTP", userController.verifyOTP);
route.post("/signup/resendOTP", userController.resendOTP);
route.get("/signup/googleAuth", passport.authenticate("google", { scope: ["profile", "email"] }));
route.get(
    "/signup/google/callback",
    passport.authenticate("google", { successRedirect: "/", failureRedirect: "/signup", prompt: 'select_account' }),
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
