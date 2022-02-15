const prefix = 'API call failed: ';

const validate = error => error.message && typeof error.message === 'string' && error.message.startsWith(prefix);
const parse = error => validate(error) ? JSON.parse(error.message.substring(prefix.length)) : {name: undefined};

module.exports = error => {
    const json = parse(error);
    if (json.name === 'AMOUNT_TOO_SMALL') {
        return { name: json.name };
    }

    return null;
}