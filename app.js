const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const PORT = process.env.PORT;

const connectDB = require("./config/db.js");

//routes
const userRoutes = require("./routes/userRoutes/routes.js");
const adminRoutes = require("./routes/adminRoutes/adminRoutes.js");

const session = require("express-session");
const passport = require("./config/passport.js");
const nocache = require("nocache");

app.set("view engine", "ejs");

//dynamic views setup
app.use((req, res, next) => {
    if (req.path.startsWith("/admin")) {
        app.set("views", path.join(__dirname, "/views/adminViews"));
    } else {
        app.set("views", path.join(__dirname, "/views/userViews"));
    }
    next();



});



//winston

const winston = require("winston");
const logger = winston.createLogger({
    level: "error",
    transports: [new winston.transports.File({ filename: "error.log" })],
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", { message: "Internal Server Error" });
});


//session management
app.use(
    session({
        secret: process.env.SECTRET_KEY,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge: 7 * 60 * 60 * 1000,
        },
    })
);

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
