const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    balance: { type: Number, default: 0, min: 0 },
    transactions: [
        {
            transactionId: { type: String, unique: true },
            type: { type: String, enum: ["Credit", "Debit"], required: true },
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            description: { type: String },
        },
    ],
});

module.exports = mongoose.model("Wallet", walletSchema);
