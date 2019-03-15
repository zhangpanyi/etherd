const BN = require('bn.js');
const validator = require('validator');
const Utils = require('./utils/utils');
const utils = require('../../ethereum/utils');
const future = require('../../common/future');

module.exports = async function(ethereum, req, callback) {
   // 校验参数
   const rule = [
        {
            name: 'owner',
            value: null,
            is_valid: function(owner) {
                if (owner != '' && !validator.matches(owner, '0x[a-zA-Z0-9]{40}')) {
                    return false;
                }
                this.value = owner;
                return true;
            }
        },
        {
            name: 'initialAmount',
            value: null,
            is_valid: function(initialAmount) {
                if (!validator.isInt(initialAmount)) {
                    return false;
                }
                let bn = new BN(initialAmount, 10);
                if (bn.cmp(new BN(0, 10)) != 1) {
                    return false;
                }
                this.value = initialAmount;
                return true;
            }
        },
        {
            name: 'name',
            value: null,
            is_valid: function(name) {
                if (name.length <= 0) {
                    return false;
                }
                if (name.length > 24) {
                    return false;
                }
                if (!validator.isAscii(name)) {
                    return false;
                }
                this.value = name;
                return true;
            }
        },
        {
            name: 'decimals',
            value: null,
            is_valid: function(decimals) {
                if (parseInt(decimals) < 0) {
                    return false;
                }
                if (parseInt(decimals) > 18) {
                    return false;
                }
                if (!validator.isInt(decimals)) {
                    return false;
                }
                this.value = decimals;
                return true;
            }
        },
        {
            name: 'symbol',
            value: null,
            is_valid: function(symbol) {
                if (symbol.length < 2) {
                    return false;
                }
                if (symbol.length > 5) {
                    return false;
                }
                if (!validator.isAscii(symbol)) {
                    return false;
                }
                this.value = symbol;
                return true;
            }
        },
    ];
    if (!Utils.validationParams(req, rule, callback)) {
        return;
    }

    // 部署合约
    let error, hash;
    let initialAmount = rule[1].value;
    let decimals = parseInt(rule[3].value);
    initialAmount = utils.toWei(initialAmount, decimals);
    [error, hash] = await future(ethereum.deployERC20Token(
        rule[0].value.toString(), initialAmount, rule[2].value,
        parseInt(decimals), rule[4].value.toString()));
    if (error != null) {
        error = {code: -32000, message: error.message};
        callback(error, undefined);
        return;
    }
    callback(undefined, hash);
}
