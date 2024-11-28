const crypto = require("crypto");


const generateOTP = async()=>{

 return crypto.randomInt(100000,999999).toString();

}


module.exports=generateOTP;