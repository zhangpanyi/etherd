
const Nedb = require('nedb-promise');
const future = require('../common/future');

class Datastore {
    constructor() {
        this._db = new Nedb({
            filename: 'transactions.db',
            autoload: true,
        });
        this._db.ensureIndex({fieldName: 'txid', unique: true});
    }

    // 查询交易
    async find(txid) {
        let error, res;
        [error, res] = await future(this._db.find({txid: txid}));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 查询挂起交易
    async txPending() {
        let error, res;
        [error, res] = await future(this._db.find({pending: true}));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 查询完成交易
    async txCompleted() {
        let error, res;
        [error, res] = await future(this._db.find({ok: true}));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 更新交易凭据
    async updateReceipt(txid, contractAddress, ok) {
        let error, res;
        [error, res] = await future(this._db.update(
            {txid: txid},
            {$set: {contractAddress: contractAddress, ok: ok, pending: false}},
            {},
        ));
        if (error != null) {
            throw error;
        }
        return res;
    }

    // 插入交易
    async insert(owner, initialAmount, name, decimals, symbol, txid) {
        let error, res;
        [error, res] = await future(this._db.insert({
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

module.exports = Datastore;
