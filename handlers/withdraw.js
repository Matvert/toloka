const { Markup } = require("telegraf");
const { Assets } = require("@foile/crypto-pay-api");
const Big = require('big.js');
const { transfer } = require("../helpers").payments;
const {v4: uuidv4} = require("uuid");
const getError = require("../helpers/errors");

const withdraw = async ctx => {
    delete ctx.session.action;

    const currencies = Object.keys(Assets);

    let keyboard = [];

    const row = 3;
    const length = Math.ceil(currencies.length / row);

    for (let i = 0; i < length; i++) {
        const c = currencies.slice(i, i+row);
        keyboard.push(c.map(name => Markup.callbackButton(name, 'withdraw_' + name)));
    }
    
    keyboard.push([Markup.callbackButton(ctx.i18n.t('back'), 'cabinet')]);
    
    
    await ctx.editMessageText(ctx.i18n.t('select_currency'), {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard)
    });

}

const onWithdrawCurrencySelected = async ctx => {
    ctx.session.action = 'withdraw';
    ctx.session.asset = ctx.match[ctx.match.length-1];
    if (!Object.keys(Assets).includes(ctx.session.asset)) {
        delete ctx.session.action;
        delete ctx.session.asset;
        return;
    }
    
    const text = ctx.i18n.t('enter_amount', {
        currency: ctx.session.asset
    })
    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            Markup.callbackButton(ctx.i18n.t('back'), 'withdraw')
        ])
    });
}


const onWithdrawAmountSelected = async ctx => {

    delete ctx.session.action;
    
    const session = await ctx.db.connection.startSession();
    await session.startTransaction();

    try {
        
        if (isNaN(ctx.message.text) || new Big(ctx.message.text).eq('0')) {
            return await ctx.reply(ctx.i18n.t('enter_positive_number'));
        }
    
        const asset = ctx.user.assets.find(a => a.name === ctx.session.asset);
        
        
        if (!asset || new Big(ctx.message.text).gt(asset.amount)) {
            await ctx.reply(ctx.i18n.t('not_enough_money'));
            return;
        }
        
        await transfer(uuidv4(), ctx.session.asset, ctx.message.text, ctx.from.id);

        ctx.user.assets.forEach((asset, i) => {
            if (asset.name !== ctx.session.asset) return;
            ctx.user.assets[i].amount = new Big(asset.amount).minus(ctx.message.text).toString();
        });

        await ctx.user.save();
        

        await ctx.reply(ctx.i18n.t('transfer_success', {
            amount: ctx.message.text,
            asset: ctx.session.asset
        }));
    
        await session.commitTransaction();
        await session.endSession();

    } catch(error) {
        await session.abortTransaction();
        await session.endSession();
        console.log(error);
        const er = getError(error);
        await ctx.reply(er ? ctx.i18n.t(er.name.toLowerCase(), er) : ctx.i18n.t('error'));
    }

}

module.exports = {
    withdraw,
    onWithdrawCurrencySelected,
    onWithdrawAmountSelected
}