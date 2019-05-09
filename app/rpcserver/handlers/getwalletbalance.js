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
    const dict = ethereum.getWalletBalances(rule[0].value);
    const keys = Object.keys(dict);
    for (index in keys) {
        const address = keys[index];
        const balance = new BigNumber(dict[address], 10);
        if (balance.comparedTo(zero) > 0) {
            balances.push({'address': address, 'balance': dict[address]});
        }
    }

    // 计算钱包余额
    callback(undefined, balances);
}
