const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const nocache = require("nocache");
const passport = require("./config/passport.js");
const connectDB = require("./config/db.js");
const cookieParser = require("cookie-parser");

// Routes
const userRoutes = require("./routes/userRoutes/routes.js");
const adminRoutes = require("./routes/adminRoutes/adminRoutes.js");

// Environment Variables
const PORT = process.env.PORT;
const SECTRET_KEY = process.env.SECTRET_KEY;

// View Engine
app.set("view engine", "ejs");

app.use(cookieParser()); // Enable cookie parsing middleware

// Session Management
app.use(
    session({
        name: "session_id",
        secret: SECTRET_KEY,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 60 * 1000 * 60 * 7, // 7 hour
        },
    })
);

// Dynamic Views Setup
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) {
        app.set("views", path.join(__dirname, "/views/adminViews"));
    } else {
        app.set("views", path.join(__dirname, "/views/userViews"));
    }
    next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
app.use(nocache());

// Assign User to Response Locals
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Database Connection
connectDB();

// Routes
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Port is connected at ${PORT}`);
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "Internal Server Error" });
});
