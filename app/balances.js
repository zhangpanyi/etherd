const geth = require('../config/geth');
const sleep = require('./common/sleep');
const nothrow = require('./common/nothrow');
const BigNumber = require('bignumber.js');

const ZERO = new BigNumber(0, 10);

class Balances {
    constructor(ethereum, symbol) {
        this.symbol = symbol;
        this._ethereum = ethereum;
        this._balances = new Map();
        this._changeSet = new Set();
        if (geth.balance_cache) {
            for (let address of this._ethereum.getAccounts()) {
                this._changeSet.add(address);
            }
            this._queryBalances();
        }
    }

    // 获取钱包总额
    balances() {
        return this._balances;
    }

    // 更新地址余额
    updateBalance(address) {
        if (geth.balance_cache) {
            this._changeSet.add(address);
        }
    }

    // 查询地址余额
    async _queryBalances() {
        while (true) {
            if (this._changeSet.size == 0) {
                await sleep(1000);
                continue;
            }

            for (let address of this._changeSet) {
                let error, balance;
                [error, balance] = await nothrow(this._ethereum.getBalance(address, this.symbol));
                if (error != null) {
                    await sleep(1000 * 5);
                    continue;
                } else {
                    this._changeSet.delete(address);
                    const num = new BigNumber(balance, 10);
                    if (num.comparedTo(ZERO) > 0) {
                        this._balances.set(address, balance);
                    }
                }
            }
        }
    }
}

class Manager {
    constructor(ethereum) {
        this._ethereum = ethereum;
        this._balances = new Map();
        this._loadBalances();
    }

    // 获取余额
    get(symbol) {
        if (!this._balances.has(symbol)) {
            return [];
        }
        return this._balances.get(symbol).balances();
    }

    // 更新余额
    update(address, symbol) {
        if (!this._balances.has(symbol)) {
            this._balances.set(symbol, new Balances(this._ethereum, symbol));
        }
        this._balances.get(symbol).updateBalance(address);
    }

    // 加载余额缓存
    async _loadBalances() {
        let symbols = await this._ethereum.getSymbols();
        for (let idx in symbols) {
            let symbol = symbols[idx];
            if (!this._balances.has(symbol)) {
                this._balances.set(symbol, new Balances(this._ethereum, symbol));
            }
        }
    }
}

module.exports = Manager;
