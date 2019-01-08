const Utils = require('./utils/utils');
const validator = require('validator');
const future = require('../../common/future');

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

    // 计算钱包余额
    let balances = new Array();
    for (let address of ethereum.getAccounts()) {
        let error, balance;
        [error, balance] = await future(ethereum.getBalance(address, rule[0].value));
        if (error != null) {
            error = {code: -32000, message: error.message};
            callback(error, undefined);
            return;
        }
        balances.push({'address': address, 'balance': balance.toString()});
    }
    callback(undefined, balances);
}
