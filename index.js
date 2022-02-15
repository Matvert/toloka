const express = require("express");
const config = require("./config");
const bot = require("./bot");
const { Assets } = require("@foile/crypto-pay-api");
const { MongoClient } = require('mongodb');
const { session } = require('telegraf-session-mongodb');
const TelegrafI18n = require('telegraf-i18n');
const path = require("path");

const { db } = require('./database');
const handlers = require("./handlers");

async function start() {

    const i18n = new TelegrafI18n({
        defaultLanguage: 'en',
        directory: path.resolve(__dirname, 'locales')
    });  
    bot.use(i18n.middleware());
    const client = await MongoClient.connect(config.db, { useNewUrlParser: true, useUnifiedTopology: true })
    bot.use(session(client.db(), { collectionName: 'sessions' }));

    
    bot.use(async (ctx, next) => {
        ctx.db = db;
        ctx.user = await ctx.db.User.findOne({ user: ctx.from.id });
        if (ctx.user == null) {
            const user = new db.User();
            const amount = '0';
            user.user = ctx.from.id;
            user.language = 'en';
            user.assets = Object.keys(Assets).map(name => ({ name, amount }));
            user.blocked = Object.keys(Assets).map(name => ({ name, amount }));
            ctx.user = await user.save();
        }
        ctx.i18n.locale(ctx.user.language);
        await next();
    });
    
    bot.command('start', handlers.start);
    bot.action('publish_task', handlers.publishTaskHandler);
    bot.action('cancel', handlers.cancelPublishTask);
    bot.action('add', handlers.addHandler);
    bot.action('withdraw', handlers.withdraw);
    bot.action('deposit', handlers.deposit);
    bot.action('cabinet', handlers.cabinet);
    bot.action(/asset_(.+)/, handlers.assetHandler);
    bot.action(/deposit_(.+)/, handlers.onCurrencySelected);
    bot.action(/withdraw_(.+)/, handlers.onWithdrawCurrencySelected);
    bot.action(/tasks (\d+)/, handlers.tasks);
    bot.action(/view_task_(.+)/, handlers.task);
    bot.action(/finish_(.+)/, handlers.finishApplication);
    bot.action(/reject_(.+)/, handlers.rejectApplication);
    bot.action(/accept_(.+)/, handlers.accept);
    bot.action(/change_language_(en|ru)/, handlers.changeLanguage);
    bot.action(/my_tasks_(.+)/, handlers.myTasks);
    bot.action(/manage_task_(.+)/, handlers.taskManage);
    bot.action(/delete_task_(.+)/, handlers.taskDelete);
    
    bot.action('back', handlers.start);
    
    bot.on('error', console.log);
    bot.on("text", async ctx => {
        try {
            if (ctx.session.currentTask) {
                await handlers.onApplicationText(ctx);
                return;
            }
        
            if (!ctx.session.action) return;
            const actions = {
                "deposit": handlers.onAmountSelected,
                "withdraw": handlers.onWithdrawAmountSelected,
                // adding new task
                "title": handlers.titleHandler,
                "rules": handlers.rulesHandler,
                "price": handlers.priceHandler,
                "max": handlers.countHandler
            };
        
            const { action } = ctx.session;
        
            if (!actions.hasOwnProperty(action)) {
                console.log(`Unknown action "${action}"`);
                return;
            }
        
            await actions[action](ctx);
        } catch(error)  {
            console.log(error);
        }
    });

    const app = express();
    bot.telegram.setWebhook(`${config.domain}/bot`);
    app.post("/webhook", express.json(), (req, res) => {
        const update = req.body;
        const { invoice_id } = update.payload;
        const session = await db.connection.startSession();
        await session.startTransaction();

    try {
        let invoice = await db.Invoice.findOne({ invoiceId: invoice_id });
        invoice.paid = true;
        await invoice.save();
        let ctx = { user: await db.User.findOne({ user: invoice.user })};
        let transferred = false;
        ctx.user.assets.forEach((asset, i) => {
            if (asset.name !== invoice.asset) return;
            transferred = true;
            ctx.user.assets[i].amount = new Big(asset.amount).plus(invoice.amount).toString();
        });
    
        if (!transferred) {
            ctx.user.assets.push({ name: invoice.asset, amount: invoice.amount });
        }
        await ctx.user.save();
        const bot = require("../bot");
        await bot.telegram.sendMessage( 
            invoice.user,
            '<b>+' + invoice.amount + ' ' + invoice.asset + '</b>',
            { parse_mode: 'HTML' }
        );
    
        await session.commitTransaction();
        await session.endSession();
    } catch(error) {
        await session.abortTransaction();
        await session.endSession();
        console.log(error);
    } 
    });
    app.use(bot.webhookCallback('/bot'))
    app.listen(process.env.PORT || 3000);
}

start();
