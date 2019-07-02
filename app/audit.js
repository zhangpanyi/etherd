const geth = require('../config/geth');
const sleep = require('./common/sleep');
const logger = require('./common/logger');
const nothrow = require('./common/nothrow');

const STATWAIT = 0;
const STATFAIL = 1;
const STATSUCCESS = 2;

class Audit {
    constructor(web3, transactions, nonce) {
        this._web3 = web3;
        this._nonce = nonce;
        this._started = false;
        this._transactions = transactions;
    }

    // 检查凭据
    async checkReceipt(txid, createdAt) {
        let error, tx;
        [error, tx] = await nothrow(this._web3.eth.getTransactionReceipt(txid));
        if (error != null) {
            throw error;
        }
        const date = Date.parse(new Date())/1000;
        const expired = date >= createdAt + geth.expire;

        if (!tx) {
            if (expired) {
                return STATFAIL;
            }
            return STATWAIT;
        }

        if (tx.blockNumber == null) {
            if (expired) {
                return STATFAIL;
            }
            return STATWAIT;
        }
        return STATSUCCESS;
    }

    // 轮询事务
    async startPolling() {
        if (this._started) {
            return;
        }
        this._started = true;

        while (true) {
            const accounts = await this._transactions.all();
            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                for (let j = 0; j < account.transactions.length;) {
                    let error, stat;
                    const tx = account.transactions[j];
                    [error, stat] = await nothrow(this.checkReceipt(tx.txid, tx.date));
                    if (error != null) {
                        logger.info('[audit] Failed to get transaction receipt, %s', error.message);
                        continue;
                    }

                    if (stat == STATWAIT) {
                        break
                    } else if (stat == STATFAIL) {
                        await nothrow(this._nonce.setInvalid(account.account, tx.nonce));
                        logger.error('[audit] Audit failure, account: %s, txid: %s, nonce: %s', account.account, tx.txid, tx.nonce);
                        break;
                    }
                    await nothrow(this._transactions.deleteTx(account.account, tx.nonce));
                    logger.info('[audit] Audit success, account: %s, txid: %s, nonce: %s', account.account, tx.txid, tx.nonce);
                    j++;
                }
            }
            await sleep(1000 * 10);
        }
    }
}

module.exports = Audit;
