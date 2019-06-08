const sleep = require('./common/sleep');
const future = require('./common/future');

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
            [error, count] = await future(web3.eth.getTransactionCount(account, 'latest'));
            if (error != null) {
                throw error;
            }

            await this._transactions.ensure(account);
            let txs = await this._transactions.getTxs(account);
            if (txs.length > 0 && txs[txs.length-1].nonce > count) {
                count = txs[txs.length-1].nonce;
            }

            if (!this._table.has(account)) {
                this._table.set(account, {nonce: count, locked: false});
            }
        }
    }

    // 获取nonce
    async getNonce(account) {
        await this.ensure(account);
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
        };
        return [state.nonce, callback];
    }

    // 设置无效nonce
    async setInvalid(account, nonce) {
        await this.ensure(account);
        while (this._table.get(account).locked) {
            await sleep(100); 
        }
        let state = this._table.get(account);
        state.nonce = nonce;
        state.locked = true;
        this._table.set(account, state);
        await future(this._transactions.deleteTxs(account, nonce));
        state.locked = false;
        this._table.set(account, state);
    }
}

module.exports = Nonce;
