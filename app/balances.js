const geth = require('../config/geth');
const sleep = require('./common/sleep');
const future = require('./common/future');
const BigNumber = require('bignumber.js');

const ZERO = new BigNumber(0, 10);

class Balances {
    constructor(ethereum, symbol) {
        this._balances = {};
        this.symbol = symbol;
        this._ethereum = ethereum;
        this._changeSet = new Set();

        if (geth.balance_cache) {
            for (let address of this._ethereum.getAccounts()) {
                this._changeSet.add(address);
            }
            this._queryAllBalances();
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
    async _queryAllBalances() {
        while (true) {
            if (this._changeSet.size == 0) {
                await sleep(1000);
                continue;
            }

            for (let address of this._changeSet) {
                let error, balance;
                [error, balance] = await future(this._ethereum.getBalance(address, this.symbol));
                if (error != null) {
                    await sleep(1000 * 5);
                    continue;
                } else {
                    this._changeSet.delete(address);
                    const num = new BigNumber(balance, 10);
                    if (num.comparedTo(ZERO) > 0) {
                        this._balances[address] = balance;
                    }
                }
            }
        }
    }
    
}

module.exports = Balances;
