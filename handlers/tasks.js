const { Markup } = require("telegraf");
const bson = require("bson");
const Big = require("big.js");

const tasks = async ctx => {
    try {
        const limit = 5;
        const page = parseInt(ctx.match[ctx.match.length-1]);
        
        const count = await ctx.db.Task.count({ active: true});
        const pages = Math.ceil(count/limit); 
    
        let reply_markup;
    
        const backButton = Markup.callbackButton(ctx.i18n.t('back'), 'back'); 
    
        if (count === 0) {
            reply_markup = Markup.inlineKeyboard([
                [backButton]
            ]);
            await ctx.editMessageText(
                ctx.i18n.t('no_tasks'),
                { reply_markup }
            );
            return;
        }
    
        if (page <= 0) {
            await ctx.answerCbQuery(ctx.i18n.t('first_page'));
            return;
        } else if (page > pages) {
            await ctx.answerCbQuery(ctx.i18n.t('last_page')); 
            return;
        }
    
        ctx.session.page = page;
        const tasks = await ctx.db.Task.find({ active: true}).skip(limit*(page-1)).limit(limit);

        reply_markup = Markup.inlineKeyboard([
            ...tasks.map(task => {
                let title = task.title;
                let max = 13;
                if (title.length >= max) title = title.substring(0, max-3) + '...';        
                return [Markup.callbackButton('- ' + title + ' ' + task.amount + ' ' + task.asset, 'view_task_' + task._id)]
            }),
            [
                Markup.callbackButton('<', 'tasks ' + (page-1)),
                Markup.callbackButton('>', 'tasks ' + (page+1))
            ],
            [ backButton ]
        ])
        await ctx.editMessageText(
            ctx.i18n.t('actual_tasks_message'), 
            { reply_markup }
        )
    } catch(error) {
        console.log(error);
    }
}

const task = async ctx => {
    
    const id = ctx.match[ctx.match.length-1];
    const task = await ctx.db.Task.findOne({ _id: id });
    if (!task) {
        await ctx.answerCbQuery(ctx.i18n.t('task_not_found'));
        return;
    }
    if (!task.active) {
        await ctx.answerCbQuery(ctx.i18n.t('task_not_actual'));
        return;
    }
    const buttons = [
        [Markup.callbackButton(ctx.i18n.t('do'), 'accept_' + task._id)],
        [Markup.callbackButton(ctx.i18n.t('back'), 'tasks ' + (ctx.session.page || '1'))]
    ]

    const reply_markup = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(
        ctx.i18n.t('task_info', { ...task, id }),
        { parse_mode: 'HTML', reply_markup }
    )
}

const accept = async ctx => {
    if (ctx.session.currentTask) {
        await ctx.answerCbQuery(ctx.i18n.t('you_already_do'))
        return;
    }
    const id = ctx.match[ctx.match.length-1];
    const task = await ctx.db.Task.findOne({ _id: id });
    if (!task) {
        await ctx.answerCbQuery(ctx.i18n.t('task_not_found'));
        return;
    }
    if (!task.active) {
        await ctx.answerCbQuery(ctx.i18n.t('task_not_actual'));
        return;
    }
    if (task.user === ctx.from.id) {
        await ctx.answerCbQuery(ctx.i18n.t('cannot_do_own_task'));
        return;
    }

    const application = new ctx.db.Application();
    application.task = new bson.ObjectID(id);
    application.active = true;
    application.accepted = false;
    application.proofs = [];
    application.user = ctx.from.id;
    await application.save();

    const applicationsCount = await ctx.db.Application.count({ task: application.task, active: true });
    if (task.maxApplications >= applicationsCount) {
        task.active = false;
        await task.save();
    }
    
    ctx.session.action = 'application';
    ctx.session.application = application._id.toString();
    ctx.session.currentTask = id;
    setTimeout(async() => {
        if (!ctx.session.currentTask) return;
        delete ctx.session.action;
        delete ctx.session.currentTask;
        application.active = false;
        await application.save();

        const applicationsCount = await ctx.db.Application.count({ task: application.task, active: true });
        if (task.maxApplications > applicationsCount) {
            task.active = true;
            await task.save();
        }

        await ctx.editMessageText(ctx.i18n.t('time_over'));
    }, 30*60*1000);

    await ctx.editMessageText(ctx.i18n.t('send_solution'), {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
            Markup.callbackButton('Отменить', 'cancel_task')
        ])
    });
}

const onApplicationText = async ctx => {
    const task = await ctx.db.Task.findOne({ _id: ctx.session.currentTask });
    const application = await ctx.db.Application.findOne({ _id: ctx.session.application });
    application.proof = ctx.message.text;
    await application.save();

    await ctx.reply(ctx.i18n.t('sent'));

    const reply_markup = Markup.inlineKeyboard(
        [Markup.callbackButton(ctx.i18n.t('accept'), 'finish_' + ctx.session.application),
        Markup.callbackButton(ctx.i18n.t('reject'), 'reject_' + ctx.session.application)]
    );
    
    delete ctx.session.currentTask;

    await ctx.telegram.sendMessage(task.user, ctx.i18n.t('task_solved', { _id: task._id, text: ctx.message.text }), { reply_markup });
}

const finishApplication = async ctx => {
    const _id = ctx.match[ctx.match.length-1];
    const app = await ctx.db.Application.findOne({ _id });
    app.accepted = true;
    app.active = false;
    await app.save();
    
    await ctx.editMessageText(ctx.i18n.t('accepted_task', app), { parse_mode: 'HTML'});
    
    const task = await ctx.db.Task.findOne({ _id: app.task });
    const owner = ctx.user;
    const appOwner = await ctx.db.User.findOne({ user: app.user });
    owner.blocked.forEach(async(asset, i) => {
        if (asset.name === task.asset) {
            owner.blocked[i].amount = new Big(asset.amount).minus(task.amount).toString();
            await owner.save();
        }
    });
    appOwner.assets.forEach(async(asset, i) => {
        if (asset.name === task.asset) {
            appOwner.assets[i].amount = new Big(asset.amount).plus(task.amount).toString();
            await appOwner.save();
        }
    })

    await ctx.telegram.sendMessage(app.user, ctx.i18n.t("task_executed", { amount: task.amount, asset: task.asset }));
}

const rejectApplication = async ctx => {
    const _id = ctx.match[ctx.match.length-1];
    const app = await ctx.db.Application.findOne({ _id });
    app.accepted = false;
    app.active = false;
    await app.save();
    
    const task = await ctx.db.Task.findOne({ _id: app.task });
    const applicationsCount = await ctx.db.Application.count({ task: app.task, active: true });
    if (task.maxApplications > applicationsCount) {
        task.active = true;
        await task.save();
    }

    await ctx.editMessageText(ctx.i18n.t('failed_task', app), { parse_mode: 'HTML' });
    
    await ctx.telegram.sendMessage(app.user, ctx.i18n.t("task_failed"));
}

const myTasks = async ctx => {
    const page = parseInt(ctx.match[ctx.match.length-1]);

    if (page == 0) {
        await ctx.answerCbQuery(ctx.i18n.t('first_page'));
        return;
    }

    const count = await ctx.db.Task.count({ user: ctx.from.id });
    const limit = 5;

    if (Math.ceil(count/limit) < page) {
        await ctx.answerCbQuery(ctx.i18n.t('last_page'));
        return;
    }

    const tasks = await ctx.db.Task.find({ user: ctx.from.id }).skip(limit*(page-1)).limit(limit);
    let keyboard = [];
    let text = ctx.i18n.t('no_tasks');

    if (tasks.length > 0) {
        ctx.session.page = page;
        keyboard = tasks.map(task => {
            const max = 13;
            const title = task.title.length > max ? task.title.substring(0, max-3) + '...' : task.title;
            return [Markup.callbackButton(`- ${title} ${task.amount} ${task.asset}`, 'manage_task_' + (task._id))];
        });

        text = ctx.i18n.t('actual_tasks_message');
        keyboard.push([
            Markup.callbackButton('<', 'my_tasks_' + (page-1)),
            Markup.callbackButton('>', 'my_tasks_' + (page+1))
        ]);
    }

    keyboard.push([Markup.callbackButton(ctx.i18n.t('back'), 'cabinet')]);

    await ctx.editMessageText(text, { reply_markup: Markup.inlineKeyboard(keyboard) });
}

const taskManage = async ctx => {
    const _id = ctx.match[ctx.match.length-1];
    const task = await ctx.db.Task.findOne({ _id });
    if (!task) return;
    if (task.user !== ctx.from.id) return;
    const reply_markup = Markup.inlineKeyboard([
        [Markup.callbackButton(ctx.i18n.t('delete'), 'delete_task_' + _id)],
        [Markup.callbackButton(ctx.i18n.t('back'), 'my_tasks_' + (ctx.session.page || 1))]
    ]);
    await ctx.editMessageText(
        ctx.i18n.t('task_info', { id: _id, ...task }),
        { parse_mode: 'HTML', reply_markup }
    )
}

const taskDelete = async ctx => {
    const _id = ctx.match[ctx.match.length-1];
    const task = await ctx.db.Task.findOne({ _id });
    if (!task) return;
    if (task.user !== ctx.from.id) return;
    const apps = await ctx.db.Application.count({ task: _id, active: true });
    const valid = await ctx.db.Application.count({ task: _id, accepted: true });
    if (apps > 0) {
        await ctx.answerCbQuery(ctx.i18n.t('already_deleted')/*"Удалить данное задание невозможно, так как есть активные заявки"*/);
        return;
    }
    ctx.user.blocked.forEach((asset, i) => {
        if (asset.name === task.asset) {
            const amount = new Big(task.amount).times(task.maxApplications-valid);
            ctx.user.blocked[i].amount = new Big(ctx.user.blocked[i].amount).minus(amount).toString();
            ctx.user.assets[i].amount = new Big(ctx.user.assets[i].amount).plus(amount).toString();
        }
    });
    await ctx.user.save();
    await task.remove();
    const reply_markup = Markup.inlineKeyboard([
        [Markup.callbackButton(ctx.i18n.t('back'), 'my_tasks_1')]
    ]);
    await ctx.editMessageText(/*'Задание удалено'*/ctx.i18n.t('task_deleted'), { reply_markup });
}

module.exports = {
    tasks,
    task,
    accept,
    onApplicationText,
    rejectApplication,
    finishApplication,
    myTasks,
    taskManage,
    taskDelete
};