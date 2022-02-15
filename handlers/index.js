const start = require("./start");
const cabinet = require("./cabinet");
const { deposit, onCurrencySelected, onAmountSelected } = require("./deposit");
const {
    withdraw,
    onWithdrawCurrencySelected,
    onWithdrawAmountSelected
} = require("./withdraw");
const {
    addHandler,
    titleHandler,
    rulesHandler,
    priceHandler,
    countHandler,
    cancelPublishTask,
    publishTaskHandler,
    assetHandler
} = require("./add");
const { tasks, task, onApplicationText, finishApplication, rejectApplication, accept, myTasks, taskManage, taskDelete } = require("./tasks");
const changeLanguage = require("./languages");

module.exports = {
    start,
    cabinet, 
    deposit, 
    onCurrencySelected,
    onAmountSelected, 
    withdraw,
    onWithdrawAmountSelected,
    onWithdrawCurrencySelected,
    onWithdrawAmountSelected,
    addHandler,
    titleHandler,
    rulesHandler,
    priceHandler,
    countHandler,
    cancelPublishTask,
    publishTaskHandler,
    assetHandler,
    tasks,
    task,
    onApplicationText,
    finishApplication,
    rejectApplication,
    accept,
    changeLanguage,
    myTasks,
    taskManage,
    taskDelete
};