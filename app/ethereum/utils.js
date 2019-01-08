const fs = require('fs');
const BN = require('bn.js');
const path = require('path');
const keythereum = require('keythereum');
const BigNumber = require('bignumber.js');
const logger = require('../common/logger');

module.exports = {
    toWei: function(amount, decimals) {
        let base = new BigNumber(10, 10);
        let value = new BigNumber(amount, 10);
        let wei = value.multipliedBy(base.pow(decimals));
        let bn = new BN(wei.toString(10), 10);
        return bn.toString();
    },

    fromWei: function(amount, decimals) {
        let base = new BigNumber(10, 10);
        let value = new BigNumber(amount, 10);
        return value.div(base.pow(decimals)).toString(10);
    },

    readPrivateKey(keystore, unlockPassword) {
        let buffer = fs.readFileSync(path.join('.', keystore));
        try {
            let obj = JSON.parse(buffer);
            let privateKey = keythereum.recover(unlockPassword, obj);
            return [privateKey, '0x'+obj.address];
        } catch (error) {
            logger.info('Failed to get private key, unlock password is invalid, %s', error.message);
            throw error;
        }  
    }
};
