
module.exports = async ctx => {
    const lang = ctx.match[ctx.match.length-1];
    ctx.i18n.locale(lang);
    ctx.user.language = lang;
    await ctx.user.save();
    await ctx.editMessageText(ctx.i18n.t('language_updated'));
}