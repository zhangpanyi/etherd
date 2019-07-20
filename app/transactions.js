
const fs = require('fs');
const Nedb = require('nedb-promise');

const nothrow = require('./common/nothrow');

class Transactions {
    constructor() {
        if (!fs.existsSync('db')) {
            fs.mkdirSync('db');
        }
        this._db = new Nedb({
            autoload: true,
            filename: 'db/transactions.db',
        });
        this._db.ensureIndex({fieldName: 'account', unique: true});
    }

    // 获取全部记录
    async asyncGetAll() {
        let error, result;
        [error, result] = await nothrow(this._db.find({}));
        if (error != null) {
            throw error;
        }
        return result;
    }

    // 确保账户存在
    async asyncEnsure(account) {
        let error, count;
        [error, count] = await nothrow(this._db.count({account: account}));
        if (error != null) {
            throw error;
        }

        if (count > 0) {
            return true;
        }

        let result;
        [error, result] = await nothrow(this._db.insert({
            account:        account,
            transactions:   [],
        }));
        if (error != null) {
            throw error;
        }
        return true;
    }

    // 获取用户交易记录
    async asyncGetTxs(account) {
        let error, result;
        [error, result] = await nothrow(this._db.find({account: account}));
        if (error != null) {
            throw error;
        }
        if (result.length == 0) {
            return [];
        }
        return result[0].transactions;
    }


    // 获取rawTransaction
    async asyncGetRawTransaction(account, txid) {
        let error, result;
        [error, result] = await nothrow(this._db.find({account: account}));
        if (error != null) {
            throw error;
        }
        if (result.length == 0) {
            return null;
        }
        for (let idx in result[0].transactions) {
            const item = result[0].transactions[idx];
            if (item.txid === txid) {
                return item.rawTransaction;
            }
        }
        return null;
    }

    // 更新账户交易记录
    async asyncUpdateTx(account, txid, rawTransaction) {
        let error, txs;
        [error, txs] = await nothrow(this.getTxs(account));
        if (error != null) {
            throw error;
        }

        let found = false;
        for (let idx in txs) {
            let item = txs[idx];
            if (item.nonce === rawTransaction.nonce) {
                found = true;
                item.txid = txid;
                item.rawTransaction = rawTransaction;
                break;
            }
        }

        if (!found) {
            const date = Date.parse(new Date())/1000;
            txs.push({
                txid: txid, nonce: rawTransaction.nonce,
                rawTransaction: rawTransaction, date: date
            });
        }

        let result;
        [error, result] = await nothrow(this._db.update(
            {account: account},
            {$set: {transactions: txs}},
            {},
        ));
        if (error != null) {
            throw error;
        }
        return true;
    }

    // 删除指定交易记录
    async asyncDeleteTx(account, nonce) {
        let error, txs;
        [error, txs] = await nothrow(this.getTxs(account));
        if (error != null) {
            throw error;
        }

        for (let idx in txs) {
            const tx = txs[idx];
            if (tx.nonce === nonce) {
                txs.splice(idx, 1);
                break
            }
        }

        let result;
        [error, result] = await nothrow(this._db.update(
            {account: account},
            {$set: {transactions: txs}},
            {},
        ));
        if (error != null) {
            throw error;
        }
        return true;
    }

    // 删除账户交易记录
    async asyncDeleteTxs(account, nonce) {
        let error, txs;
        [error, txs] = await nothrow(this.getTxs(account));
        if (error != null) {
            throw error;
        }

        for (let idx in txs) {
            const tx = txs[idx];
            if (tx.nonce === nonce) {
                txs = txs.splice(0, idx);
                break
            }
        }

        let result;
        [error, result] = await nothrow(this._db.update(
            {account: account},
            {$set: {transactions: txs}},
            {},
        ));
        if (error != null) {
            throw error;
        }
        return true;
    }
}

module.exports = Transactions;
