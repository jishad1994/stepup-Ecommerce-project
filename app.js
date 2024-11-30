const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const PORT = process.env.PORT;
const SECTRET_KEY = process.env.SECTRET_KEY;
const connectDB = require("./config/db.js");

//routes
const userRoutes = require("./routes/userRoutes/routes.js");
const adminRoutes = require("./routes/adminRoutes/adminRoutes.js");

const session = require("express-session");
const passport = require("./config/passport.js");
const nocache = require("nocache");

app.set("view engine", "ejs");

//session management
app.use(
    session({
        secret: SECTRET_KEY,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
        },
    })
);

//dynamic views setup
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) {
        app.set("views", path.join(__dirname, "/views/adminViews"));
    } else {
        app.set("views", path.join(__dirname, "/views/userViews"));
    }
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "Internal Server Error" });
});

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;  // Assuming the user info is stored in the session
    next();
  });
//initialize passport
app.use(passport.initialize());
app.use(passport.session());

//nocache
app.use(nocache());

// connecting  db
connectDB();
//user routes
app.use("/", userRoutes);
//admin routes
app.use("/admin", adminRoutes);

app.listen(PORT, () => {
    console.log(`port is connected at ${PORT}`);
});
