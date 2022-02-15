const { Schema } = require("mongoose");
const bson = require("bson");

module.exports = new Schema({
    task: bson.ObjectID,
    user: Number,
    active: Boolean,
    accepted: Boolean,
    proof: String
}, { timestamps: true });