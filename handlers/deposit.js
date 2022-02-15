const { Markup } = require("telegraf");
const { Assets } = require("@foile/crypto-pay-api");
const { cryptoPay, createInvoice, getInvoice } = require("../helpers").payments;
const Big = require('big.js');
const {db} = require("../database");
const getError = require("../helpers/errors");

const deposit = async ctx => {

    delete ctx.session.action;

    const currencies = Object.keys(Assets);

    let keyboard = [];

    const row = 3;
    const length = Math.ceil(currencies.length / row);

    for (let i = 0; i < length; i++) {
        const c = currencies.slice(i, i+row);
        keyboard.push(c.map(name => Markup.callbackButton(name, 'deposit_' + name)));
    }
    
    keyboard.push([Markup.callbackButton(ctx.i18n.t('back'), 'cabinet')]);
    
    await ctx.editMessageText(ctx.i18n.t('select_currency'), {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard(keyboard)
    });
}


const onCurrencySelected = async ctx => {
    ctx.session.action = 'deposit';
    ctx.session.asset = ctx.match[ctx.match.length-1];
    if (!Object.keys(Assets).includes(ctx.session.asset)) {
        delete ctx.session.action;
        delete ctx.session.asset;
        return;
    }
    const { asset } = ctx.session;
    await ctx.editMessageText(ctx.i18n.t('enter_amount', { asset }), {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
                
            Markup.callbackButton(ctx.i18n.t('back'), 'deposit')
        ])
    });
}

const onAmountSelected = async ctx => {
    if (isNaN(ctx.message.text)) {     
        return await ctx.reply(ctx.i18n.t('enter_number'));
    }
    delete ctx.session.action;
    const session = await ctx.db.connection.startSession();
    await session.startTransaction();

    try {

        const invoice = new ctx.db.Invoice();
        invoice.user = ctx.from.id;
        invoice.asset = ctx.session.asset;
        invoice.amount = ctx.message.text;
        invoice.paid = false;
        await invoice.save();

        const { pay_url, invoice_id } = await createInvoice(
            ctx.from.id,
            ctx.message.text,
            ctx.session.asset,
            '#' + invoice._id.toString()
        );

        invoice.invoiceId = invoice_id;
        await invoice.save();

        
        await ctx.reply(ctx.i18n.t('deposit', { amount: ctx.message.text, asset: ctx.session.asset}),{
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [Markup.urlButton(ctx.i18n.t('pay'), pay_url)]
            ])
        });

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

module.exports = { deposit, onCurrencySelected, onAmountSelected };
