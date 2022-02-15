const { Schema } = require("mongoose");

module.exports = new Schema({
    user: Number,
    amount: String,
    asset: String,
    invoiceId: Number,
    paid: Boolean
}, { timestamps: true });