const { Markup } = require("telegraf");

module.exports = async ctx => {

    const reply_markup = Markup.inlineKeyboard(
        [
            
            [Markup.callbackButton(ctx.i18n.t('deposit'), 'deposit')],
            [Markup.callbackButton(ctx.i18n.t('withdraw'), 'withdraw')],
            [Markup.callbackButton(ctx.i18n.t('my_tasks'), 'my_tasks_1')],
            [Markup.callbackButton(ctx.i18n.t('back'), 'back')]
        ]
    );

    const formatAsset = asset => `- ${asset.amount} <b>${asset.name}</b>`;

    const balance = ctx.user.assets.map(formatAsset).join('\n');
    const blockedBalance = ctx.user.blocked.map(formatAsset).join('\n');
    
    
    await ctx.editMessageText(ctx.i18n.t('cabinet', { balance, blockedBalance }), {
        parse_mode: 'HTML',
        reply_markup
    });
}