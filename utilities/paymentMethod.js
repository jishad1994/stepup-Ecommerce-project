const axios = require("axios");
const env = require("dotenv").config();

const fetchPaymentDetails = async (paymentId) => {
    const razorpayKeyId = "your_key_id"; // Replace with your Razorpay Key ID
    const razorpayKeySecret = "your_key_secret"; // Replace with your Razorpay Key Secret

    const auth = Buffer.from(`${process.env.RZP_KEY_ID}:${process.env.RZP_KEY_SECRET}`).toString("base64");

    try {
        const response = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        const paymentDetails = response.data;

        console.log("Payment Method:", paymentDetails.method);
        console.log("Payment Details:", paymentDetails);

        return paymentDetails.method; // Returns the payment method (e.g., upi, card, etc.)
    } catch (error) {
        console.error("Error fetching payment details:", error.response ? error.response.data : error.message);
        throw error;
    }
};


module.exports={fetchPaymentDetails}

