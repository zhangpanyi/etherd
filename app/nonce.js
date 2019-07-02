const sleep = require('./common/sleep');
const logger = require('./common/logger');
const nothrow = require('./common/nothrow');

class Nonce {
    constructor(web3, transactions) {
        this._web3 = web3;
        this._table = new Map();
        this._transactions = transactions;
    }

    // 初始信息
    async ensure(account) {
        if (!this._table.has(account)) {
            let error, count;
            const web3 = this._web3;
            [error, count] = await nothrow(web3.eth.getTransactionCount(account, 'latest'));
            if (error != null) {
                throw error;
            }

            let ok;
            [error, ok] = await nothrow(this._transactions.ensure(account));
            if (error != null) {
                throw error;
            }

            let txs;
            [error, txs] = await nothrow(this._transactions.getTxs(account));
            if (error != null) {
                throw error;
            }
            if (txs.length > 0 && txs[txs.length-1].nonce >= count) {
                count = txs[txs.length-1].nonce + 1;
            }

            if (!this._table.has(account)) {
                this._table.set(account, {nonce: count, locked: false});
            }
        }
    }

    // 获取nonce
    async getNonce(account) {
        let error, none;
        const number = Math.floor(Math.random()*10000);
        logger.debug('[nonce] %s get nonce begin, numbder: %s', account, number);
        [error, none] = await nothrow(this.ensure(account));
        if (error != null) {
            throw error;
        }

        while (this._table.get(account).locked) {
            await sleep(100); 
        }
        let state = this._table.get(account);
        state.locked = true;
        this._table.set(account, state);

        let self = this;
        let callback = function(success) {
            let state = self._table.get(account);
            if (success) {
                state.nonce++;
            }
            state.locked = false;
            self._table.set(account, state);
            logger.debug('[nonce] %s nonce callback, numbder: %s, nonce: %s, used: %s',
                account, number, state.nonce, success);
        };
        logger.debug('[nonce] %s get nonce end, numbder: %s, nonce: %s', account, number, state.nonce);
        return [state.nonce, callback];
    }

    // 设置无效nonce
    async setInvalid(account, nonce) {
        let error, none;
        [error, none] = await nothrow(this.ensure(account));
        if (error != null) {
            throw error;
        }

        while (this._table.get(account).locked) {
            await sleep(100); 
        }
        let state = this._table.get(account);
        state.nonce = nonce;
        state.locked = true;
        this._table.set(account, state);
        await nothrow(this._transactions.deleteTxs(account, nonce));
        state.locked = false;
        this._table.set(account, state);
    }
}

module.exports = Nonce;
