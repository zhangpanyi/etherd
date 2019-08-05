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
            name: 'symbol',
            value: 'ETH',
            is_valid: function(asset) {
                if (typeof(asset) == 'undefined') {
                    return true;
                }

                if (!validator.isAscii(asset)) {
                    return false;
                }
                this.value = asset;
                return true;
            }
        }
    ];
    if (!Utils.validationParams(req, rule, callback)) {
        return;
    }
    
    // 获取余额
    let error, balance;
    [error, balance] = await nothrow(
        ethereum.asyncGetBalance(rule[0].value, rule[1].value));
    if (error != null) {
        error = {code: -32000, message: error.message};
        callback(error, undefined);
        return;
    }
    callback(undefined, balance.toString());
}
