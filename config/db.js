const mongoose = require("mongoose");
const env = require("dotenv").config();

const connectDB = async () => {
    try {
        mongoose.connect(process.env.MONGODB_URI);
        console.log("database connected");
    } catch (err) {
        console.log(`database connecting error:${err.message}`);
        process.exit(1);
    }
};


module.exports=connectDB