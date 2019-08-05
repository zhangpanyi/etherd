const validator = require('validator');
const Utils = require('./utils/utils');
const nothrow = require('../common/nothrow');

module.exports = async function(ethereum, req, callback) {
    // 校验参数
    const rule = [
        {
            name: 'address',
            value: null,
            is_valid: function(address) {
                if (!validator.matches(address, '^0x[a-zA-Z0-9]{40}$')) {
                    return false;
                }
                this.value = address;
                return true;
            }
        },
        {
            name: 'txid',
            value: null,
            is_valid: function(address) {
                if (!validator.matches(address, '^0x[a-zA-Z0-9]{64}$')) {
                    return false;
                }
                this.value = address;
                return true;
            }
        }
    ];
    if (!Utils.validationParams(req, rule, callback)) {
        return;
    }

    // 重发交易
    let error, hash;
    [error, hash] = await nothrow(ethereum.asyncResend(
        rule[0].value, rule[1].value));
    if (error != null) {
        error = {code: -32000, message: error.message};
        callback(error, undefined);
        return;
    }
    callback(undefined, hash);
}
