
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
    async all() {
        let error, result;
        [error, result] = await nothrow(this._db.find({}));
        if (error != null) {
            throw error;
        }
        return result;
    }

    // 确保账户存在
    async ensure(account) {
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

    // 获取用户事务记录
    async getTxs(account) {
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

    // 更新账户事务记录
    async updateTx(account, txid, nonce) {
        let error, txs;
        [error, txs] = await nothrow(this.getTxs(account));
        if (error != null) {
            throw error;
        }

        const date = Date.parse(new Date())/1000;
        txs.push({txid: txid, nonce: nonce, date: date});

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

    // 删除指定事务记录
    async deleteTx(account, nonce) {
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

    // 删除账户事务记录
    async deleteTxs(account, nonce) {
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
