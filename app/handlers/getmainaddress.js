const Utils = require('./utils/utils');
const validator = require('validator');

module.exports = async function(ethereum, req, callback) {
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

    let token = await ethereum.asyncFindToken(rule[0].value);
    if (token == null) {
        callback(undefined, 'null');
    } else {
        callback(undefined, token.address);
    }
}