const fs = require('fs');
const Nedb = require('nedb-promise');

const nothrow = require('./common/nothrow');

class Tokens {
    constructor() {
        if (!fs.existsSync('db')) {
            fs.mkdirSync('db');
        }
        this._db = new Nedb({
            autoload: true,
            filename: 'db/tokens.db',
        });
        this._db.ensureIndex({fieldName: 'txid', unique: true});
    }

    // 查询挂起事务
    async asyncGetPendingTx() {
        let error, res;
        [error, res] = await nothrow(this._db.find({pending: true}));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 查询完成事务
    async asyncGetCompletedTx() {
        let error, res;
        [error, res] = await nothrow(this._db.find({ok: true}));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 更新事务凭据
    async asyncUpdateReceipt(txid, contractAddress, ok) {
        let error, res;
        [error, res] = await nothrow(this._db.update(
            {txid: txid},
            {$set: {contractAddress: contractAddress, ok: ok, pending: false}},
            {},
        ));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 插入事务
    async asyncInsertTx(owner, initialAmount, name, decimals, symbol, txid) {
        let error, res;
        [error, res] = await nothrow(this._db.insert({
            owner:              owner,
            initialAmount:      initialAmount,
            name:               name,
            decimals:           decimals,
            symbol:             symbol,
            txid:               txid,
            contractAddress:    null,
            ok:                 false,
            pending:            true,
        }));
        if (error != null) {
            throw error;
        }
        return res;
    }
}

module.exports = Tokens;
