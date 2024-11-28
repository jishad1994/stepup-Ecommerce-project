const passport = require("passport");

const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../model/userModel");

const env = require("dotenv");

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_AUTH_ID,
            clientSecret: process.env.GOOGLE_AUTH_SECRET,
            callbackURL: "http://localhost:3000/signup/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            console.log("Google Access Token:", accessToken);
            console.log("Google Profile:", profile);

            try {
                let user = await User.findOne({ googleId: profile.id });
                if (user) {
                    console.log("User already exists , logging in...", user);
                    return done(null, user);
                } else {
                    const username = `${profile.name.givenName} ${profile.name.familyName}`;
                    const email = profile.emails?.[0]?.value || "NoEmailProvided";
                    user = new User({ username, email, googleId: profile.id });

                    await user.save();
                    console.log("New user saved:", user);
                    return done(null, user);
                }
            } catch (error) {
                console.error("Error during Google authentication:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
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
