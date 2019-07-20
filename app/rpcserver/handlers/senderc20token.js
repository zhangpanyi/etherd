const validator = require('validator');
const Utils = require('./utils/utils');
const nothrow = require('../../common/nothrow');

module.exports = async function(ethereum, req, callback) {
    // 校验参数
    const rule = [
        {
            name: 'symbol',
            value: null,
            is_valid: function(asset) {
                if (!validator.isAscii(asset)) {
                    return false;
                }
                this.value = asset;
                return true;
            }
        },
        {
            name: 'to',
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
            name: 'amount',
            value: null,
            is_valid: function(amount) {
                if (!validator.isFloat(amount)) {
                    return false;
                }
                this.value = amount;
                return true;
            }
        }
    ];
    if (!Utils.validationParams(req, rule, callback)) {
        return;
    }

    // 发送代币
    let error, hash;
    [error, hash] = await nothrow(ethereum.asyncSendERC20Token(
        rule[0].value, rule[1].value, rule[2].value));
    if (error != null) {
        error = {code: -32000, message: error.message};
        callback(error, undefined);
        return;
    }
    callback(undefined, hash);
}
