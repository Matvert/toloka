const { Markup } = require('telegraf');
const Big = require('big.js');
const { Assets } = require("@foile/crypto-pay-api");

const cancelButton = Markup.callbackButton(
    '❌',
    'cancel'
);

const cancelKb = Markup.inlineKeyboard(
    [
        [cancelButton]
    ]
);

const addHandler = async ctx => {
    ctx.session.action = 'title';
    await ctx.editMessageText(
        ctx.i18n.t("enter_title"),
        {
            parse_mode: 'HTML',
            reply_markup: cancelKb
        }
    );
}

const titleHandler = async ctx => {
    ctx.session.action = 'rules';
    ctx.session.title = ctx.message.text;
    
    await ctx.reply(
        ctx.i18n.t("enter_rules"),
        {
            reply_markup: cancelKb
        }
    )
}


const rulesHandler = async ctx => {
    delete ctx.session.action;
    ctx.session.rules = ctx.message.text;

    const currencies = Object.keys(Assets);

    let keyboard = [];

    const row = 3;
    const length = Math.ceil(currencies.length / row);

    for (let i = 0; i < length; i++) {
        const c = currencies.slice(i, i+row);
        keyboard.push(c.map(name => Markup.callbackButton(name, 'asset_' + name)));
    }
    keyboard.push([cancelButton]);

    await ctx.reply(
        ctx.i18n.t("select_currency"),
        {
            reply_markup: Markup.inlineKeyboard(keyboard)
        }
    )
}

const assetHandler = async ctx => {
    ctx.session.action = 'price';
    ctx.session.asset = ctx.match[ctx.match.length-1];
    
    await ctx.editMessageText(
        ctx.i18n.t('enter_price'),
        {
            reply_markup: cancelKb
        }
    )
}


const priceHandler = async ctx => {
    if (isNaN(ctx.message.text) || new Big(ctx.message.text).lte("0")) {
        await ctx.reply(ctx.i18n.t('enter_positive'));
        return;
    }
    ctx.session.price = ctx.message.text;
    ctx.session.action = 'max';
    
    await ctx.reply(
        ctx.i18n.t('enter_max'),
        {
            reply_markup: cancelKb
        }
    );
}

const countHandler = async ctx => {
    if (isNaN(ctx.message.text) || parseInt(ctx.message.text) <= 0 || Math.round(ctx.message.text) != ctx.message.text) {
        await ctx.reply(ctx.i18n.t('enter_positive_round'));
        return;
    }
    ctx.session.action = 'publish';
    ctx.session.count = ctx.message.text;
    /*
            "<b>Опубликовать задание?</b>\n\n" +
        "<b>Название: </b> " + ctx.session.title + "\n" +
        "<b>Цена за 1 выполнение: </b> " + ctx.session.price + " " + ctx.session.asset + "\n" +
        "<b>Максимальное количество выполнений: </b>" + ctx.session.count + "\n" +
        "<b>Условия: </b> " + ctx.session.rules,

    */
    await ctx.reply(
        ctx.i18n.t('publish_task', ctx.session),
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard([
                [
                    Markup.callbackButton(ctx.i18n.t('accept_publish', { emoji: '✅'}), 'publish_task'),
                    Markup.callbackButton(ctx.i18n.t('cancel_publish', { emoji:'❌'}), 'cancel')
                ]
            ])
        }
    );
}

const cancelPublishTask = async ctx => {
    delete ctx.session.action;

    delete ctx.session.title;
    delete ctx.session.price;
    delete ctx.session.count;
    delete ctx.session.rules;

    
    await ctx.editMessageText(
        ctx.i18n.t('cancelled_publishing')
    );
}

const publishTaskHandler = async ctx => {

    const userAsset = ctx.user.assets.find(a => a.name === ctx.session.asset);
    const price = new Big(ctx.session.price).times(ctx.session.count);
    if (!userAsset || new Big(userAsset.amount).lt(price)) {
        const { asset } = ctx.session.asset;
        const amount = new Big(price).minus(userAsset.amount).toString();
        return ctx.answerCbQuery(ctx.i18n.t("not_enough", { amount, asset }));
    }
    delete ctx.session.action;
    let text;
    let keyboard = [];
    let extra = {};

    const session = await ctx.db.connection.startSession();
    await session.startTransaction();

    try {
        const task = new ctx.db.Task();
        task.user = ctx.from.id;
        task.maxApplications = ctx.session.count;
        task.active = true;
        task.title = ctx.session.title;
        task.description = ctx.session.rules;
        task.asset = ctx.session.asset;
        task.amount = ctx.session.price;
        await task.save();

        ctx.user.assets.forEach(async (asset, i) => {
            if (asset.name === ctx.session.asset) {
                const final = new Big(task.amount).times(task.maxApplications);
                ctx.user.assets[i].amount = new Big(asset.amount).minus(final);
                ctx.user.blocked[i].amount = new Big(ctx.user.blocked[i].amount).plus(final);
                await ctx.user.save();
            }
        });
        keyboard.push([
            Markup.callbackButton(
                ctx.i18n.t('view_task'),
                'view_task_' + task._id
            )
        ]);

        extra.reply_markup = Markup.inlineKeyboard(keyboard);
        text = ctx.i18n.t('task published');
        delete ctx.session.title;
        delete ctx.session.price;
        delete ctx.session.count;
        delete ctx.session.rules; 
        
        await session.commitTransaction();
        await session.endSession();

    } catch(error) {
        await session.abortTransaction();
        await session.endSession();

        console.log(error);
        
        text = ctx.i18n.t('error');
    } finally {

        await ctx.editMessageText(
            text,
            extra
        )
    }

}

module.exports = {
    addHandler,
    titleHandler,
    rulesHandler,
    assetHandler,
    priceHandler,
    countHandler,
    cancelPublishTask,
    publishTaskHandler
};