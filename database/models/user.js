const { Schema } = require("mongoose");

module.exports = new Schema({
    user: Number,
    language: String,
    assets: [
        {
            name: String,
            amount: String
        }
    ],
    blocked: [
        {
            name: String,
            amount: String
        }     
    ]
}, { timestamps: true });