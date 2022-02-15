const { CryptoPay, PaidButtonNames } = require('@foile/crypto-pay-api');
const config = require('../config');

const token = process.env.CRYPTOPAY_API_TOKEN;
const cryptoPay = new CryptoPay(token, {
    hostname: 'testnet-pay.crypt.bot',
    protocol: 'https',
    webhook: {
        serverHostname: 'localhost',
        serverPort: process.env.PORT || 8080,
        path: '/webhook'
    },
});

const createInvoice = async (userId, amount, asset, description) => {
    const { invoice_id, pay_url } = await cryptoPay.createInvoice(asset, amount, {
        description,
        payload: { userId },
        paid_btn_name: PaidButtonNames.OPEN_BOT,
        paid_btn_url: 'https://t.me/'+config.username
    });
    return { invoice_id, pay_url };
}

const getInvoice = invoice_ids => cryptoPay.getInvoices({ invoice_ids });

const transfer = (id, asset, amount, user) => cryptoPay.transfer(
    user,
    asset,
    amount,
    id
);

module.exports = { cryptoPay, createInvoice, getInvoice, transfer };
