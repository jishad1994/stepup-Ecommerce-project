const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../model/userModel");
const jwt = require("jsonwebtoken");
require("dotenv").config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_AUTH_ID,
            clientSecret: process.env.GOOGLE_AUTH_SECRET,
            callbackURL: "http://localhost:3000/signup/google/callback",
            prompt: "select_account",
            scope: ["openid", "profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
            console.log("Google Access Token:", accessToken);
            console.log("Google Profile:", profile);

            try {
                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    // If user doesn't exist, create a new one
                    const name = `${profile.name.givenName} ${profile.name.familyName}`;
                    const email = profile.emails?.[0]?.value || "NoEmailProvided";
                    user = new User({ name, email, googleId: profile.id });
                    await user.save();
                    console.log("New user saved:", user);
                } else {
                    console.log("User already exists, logging in...", user);
                }

                // Generate JWT Token
                const token = jwt.sign(
                    { userId: user._id, email: user.email },
                    process.env.JWT_SECRET,
                    { expiresIn: "2h" }
                );

                // Pass both user and token
                return done(null, { user, token });
            } catch (error) {
                console.error("Error during Google authentication:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((userData, done) => {
    done(null, userData.user._id); // Serialize only user ID
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then((user) => {
            done(null, user);
        })
        .catch((err) => {
            done(err, null);
        });
});

module.exports = passport;
