const express = require("express");
const route = express.Router();
const userController = require("C:/Users/Jishad/Desktop/stepUp/controllers/userControllers.js");
const userAuths = require("C:/Users/Jishad/Desktop/stepUp/middlewares/userAuth.js");
const passport = require("../../config/passport");
const env = require("dotenv");

route.use((req, res, next) => {
    console.log(` request type: ${req.method} | request url:${req.url} `);
    next();
});
route.get("/", userController.loadHomePage);
route.get("/signup", userController.loadSignup);
route.post("/signup", userController.signup);
route.get("/login", userController.loadSignin);
route.get("/logout", userController.logout);
route.get("/signup/verifyOTP", userController.loadOtpPage);
route.post("/signup/verifyOTP", userController.verifyOTP);
route.post("/signup/resendOTP", userController.resendOTP);
route.get("/signup/googleAuth", passport.authenticate("google", { scope: ["profile", "email"] }));
route.get("/signup/google/callback", passport.authenticate("google", { failureRedirect: "/signup" }), (req, res) => {
    console.log("Authentication successful, user:", req.user);
   
    // Use data from req.user instead of req.body
    const { name, email } = req.user;

    console.log(`the req.user recieved from google auth is: ${req.user}`)
    // Store authenticated user data in session
    req.session.userdata = { name, email };
    req.session.save((err) => {
        if (err) {
            console.error("Error saving session:", err);
        }
        console.log(`Current session is:`, req.session.userdata);
        res.redirect("/");
    });

    
});
route.post("/login", userAuths.isUserAuthenticated, userController.postLogin);

module.exports = route;
