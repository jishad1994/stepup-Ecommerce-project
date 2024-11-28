const nodemailer = require("nodemailer");
const env = require("dotenv").config();

//OTP sending function
const sendOTP = async (email, OTP) => {
    //create transporter
    const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: "jishadkolapurath@gmail.com",
            pass: process.env.APP_PASS,
        },
    });

    const mailOption = {
        from: process.env.APP_EMAIL,
        subject: "StepUp OTP ",
        to: email,
        text: `Your StepUp verification OTP is :${OTP}`,
        html:`<b> Your OTP:${OTP}</b>`,
    };
    //send OTP
    await transporter.sendMail(mailOption);
    console.log("OTP email send successfully");
};

module.exports = sendOTP;
