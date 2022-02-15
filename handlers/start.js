const { Markup } = require("telegraf");
const { checkDeposit } = require("./deposit");

const start = async ctx => {
        
    const text = ctx.i18n.t('start_message');
    
    const reply_markup = Markup.inlineKeyboard([
        [
            Markup.callbackButton(
                ctx.i18n.t('actual_tasks', { emoji: '🗄️' }),
                'tasks 1'
            )
        ],
        [
            Markup.callbackButton(
                ctx.i18n.t('add_task', { emoji: '📝'}),
                'add'
            )
        ],
        [
            Markup.callbackButton(
                ctx.i18n.t('cabinet_button', {emoji: '👤'}),
                'cabinet'
            )
        ],
        [
            Markup.callbackButton(
                ctx.i18n.t('change_language'),
                'change_language_' + (ctx.i18n.locale() === 'ru' ? 'en' : 'ru')
            )
        ]
    ]);
    
    if (ctx.update.callback_query) {
        await ctx.editMessageText(
            text,
            {
                reply_markup
            }   
        );
        return;
    }
    const arg = ctx.message.text.split(' ');
    if (arg[1]) {
        await checkDeposit(ctx, arg[1]);
        return;
    }
    await ctx.reply(
        text,
        {
            reply_markup
        }
    );
}

module.exports = start;