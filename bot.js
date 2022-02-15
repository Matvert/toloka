const Telegraf = require("telegraf");

const config = require("./config");

const bot = new Telegraf(config.bot.token);

module.exports = bot;