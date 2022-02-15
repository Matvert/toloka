const { Schema } = require("mongoose");

module.exports = new Schema({
    user: Number,
    maxApplications: Number,
    active: Boolean,
    published: Boolean,
    title: String,
    description: String,
    asset: String,
    amount: String
}, { timestamps: true });