const mongoose = require("mongoose");
const User = require("../model/userModel.js");
const Category = require("../model/categoryModel.js");
const Product = require("../model/productModel.js");
const bcrypt = require("bcrypt");
const genOTP = require("../utilities/genOTP.js");
const sendOTP = require("../utilities/sendOTP.js");
const env = require("dotenv").config();
const jwt = require("jsonwebtoken");
const Address = require("../model/addressModel.js");

const loadNewArrivals = async(req,res)=>{

try {
    
const userId = req.user._id;

} catch (error) {
    
}


}