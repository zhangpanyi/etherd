const Utils = require('./utils/utils');
const validator = require('validator');
const BigNumber = require('bignumber.js');

module.exports = async function(ethereum, req, callback) {
    // 校验参数
    const rule = [
        {
            name: 'symbol',
            value: 'ETH',
            is_valid: function(asset) {
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

    // 获取钱包余额
    var balances = [];
    const zero = new BigNumber(0, 10);
    for (let [key, value] of ethereum.walletBalance.get(rule[0].value)) {
        const address = key;
        const balance = new BigNumber(value, 10);
        if (balance.comparedTo(zero) > 0) {
            balances.push({'address': address, 'balance': value});
        }
    }
    callback(undefined, balances);
}
