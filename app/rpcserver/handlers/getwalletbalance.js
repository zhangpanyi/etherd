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
    callback(undefined, ethereum.getWalletBalances(rule[0].value));
}
