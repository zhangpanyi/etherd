const BN = require('bn.js');
const InputDataDecoder = require('ethereum-input-data-decoder');

const abi = require('./abi');
const Notify = require('./notify');
const Latest = require('./latest');

const sleep = require('./common/sleep');
const utils = require('./common/utils');
const logger = require('./common/logger');
const nothrow = require('./common/nothrow');

const geth = require('../config/geth');

class Poller {
    constructor(ethereum, web3) {
        this._web3 = web3;
        this._gasPrice = null;
        this._started = false;
        this._ethereum = ethereum;
        this._decoder = new InputDataDecoder(abi);
        this._lastBlockNumber = Latest.getHeigth();
    }

    // 获取Gas价格
    getGasPrice() {
        return this._gasPrice;
    }

    // 开始轮询
    async startPoll() {
        if (!this._started) {
            this._started = true;
            while (this._started) {
                if (!await this._asyncParseNextBlock()) {
                    await sleep(5000);
                }
            }
        }
    }

    // 解析下一区块
    async _asyncParseNextBlock() {
        // 获取区块高度
        let web3 = this._web3;
        let error, blockNumber, block;
        [error, blockNumber] = await nothrow(web3.eth.getBlockNumber());
        if (error != null) {
            logger.info('Failed to call `getBlockNumber`, %s', error.message);
            return false;
        }

        blockNumber = parseInt(blockNumber) - geth.confirmations;
        if (blockNumber < this._lastBlockNumber) {
            return false;
        }
        if (this._lastBlockNumber == 0) {
            this._lastBlockNumber = blockNumber;
        }
        logger.debug('Current reading block number: %d', this._lastBlockNumber);

        // 获取区块信息
        [error, block] = await nothrow(web3.eth.getBlock(this._lastBlockNumber, true));
        if (error != null) {
            logger.info('Failed to call `getBlock`, %s', error.message);
            return false;
        }

        // 解析交易信息
        let result;
        [error, result] = await nothrow(this._asyncParseTransactions(block.transactions));
        if (error != null) {
            logger.info('Failed to parse transactions, %s', error.message);
            return false;
        }

        Latest.updateHeigth(this._lastBlockNumber);
        this._lastBlockNumber += 1;
        return true;
    }

    // 解析交易列表
    async _asyncParseTransactions(transactions) {
        let web3 = this._web3;
        let gasPrices = new Array();
        let error, token, transaction;
        for (let i = 0; i < transactions.length;) {
            transaction = transactions[i];
            gasPrices.push(transaction.gasPrice);

            // 构造交易信息
            let notify = new Notify();
            notify.from = transaction.from;
            notify.hash = transaction.hash;   
            notify.blockNumber = transaction.blockNumber;
            if (transaction.to && this._ethereum.isMineAccount(transaction.to)) {
                // 普通转账
                notify.symbol = 'ETH';
                notify.to = transaction.to.toLowerCase();
                notify.amount = web3.utils.fromWei(transaction.value);
                token = await this._ethereum.asyncFindToken('ETH');
            } else {
                // 合约转账
                if (transaction.to == null) {
                    i++;
                    continue;
                }
                [error, token] = await nothrow(this._ethereum.asyncFindTokenByAddress(transaction.to));
                if (error != null) {
                    i++;
                    continue;
                }
                
                let info, ok;
                [error, [info, ok]] = await nothrow(
                    this._asyncReadContractTransfer(transaction.hash, transaction.to, transaction.input));
                if (error) {
                    logger.info('Failed to read contract transfer, %s', error.message);
                    continue;
                }
                if (!ok) {
                    i++;
                    continue;
                }
                if (info.from == null) {
                    notify.from = transaction.from;
                }
                notify.symbol = info.symbol;
                notify.to = info.to.toLowerCase();
                notify.amount = info.amount;
            }

            i++;

            // 筛选地址
            if (!this._ethereum.isMineAccount(notify.to)) {
                continue;
            }

            // 更新余额
            const fromWallet = this._ethereum.isMineAccount(notify.from);
            if (fromWallet) {
                this._ethereum.walletBalance.update(notify.from, notify.symbol);
            }
            this._ethereum.walletBalance.update(notify.to, notify.symbol);

            // 筛除转账
            if (!fromWallet && notify.from.toLowerCase() !== token.address.toLowerCase()) {
                logger.warn('Transfer has been received, from: %s, to: %s, symbol: %s, amount: %s, txid: %s',
                    notify.from, notify.to, notify.symbol, notify.amount, notify.hash);
                notify.post(token.notify);
            } else {
                logger.warn('Transfer has been received but ignore, from: %s, to: %s, symbol: %s, amount: %s, txid: %s',
                    notify.from, notify.to, notify.symbol, notify.amount, notify.hash);
            }
        }

        if (gasPrices.length <= 0) {
            return;
        }
        gasPrices.sort((a, b) => new BN(a, 10).cmp(new BN(b, 10)));
        const mid = new BN(gasPrices[parseInt(gasPrices.length / 2)], 10);
        const sum = gasPrices.reduce((acc, val) => acc.add(new BN(val, 10)), new BN(0, 10));
        const avg =  sum.divn(gasPrices.length);
        this._gasPrice = BN.min(mid, avg).toString();
    }

    // 读取合约转账
    async _asyncReadContractTransfer(txid, contractAddress, input) {
        if (contractAddress == null) {
            return [undefined, false];
        }

        // 获取token信息
        let error, token;
        [error, token] = await nothrow(this._ethereum.asyncFindTokenByAddress(contractAddress));
        if (error != null || !token) {
            return [undefined, false];
        }

        // 获取代币精度
        let decimals;
        [error, decimals] = await nothrow(this._ethereum.asyncGetDecimals(token.symbol));
        if (error) {
            logger.info('Failed to get decimals, txid: %s, %s', txid, error.message);
            return [undefined, false];
        }

        // 获取转账信息
        let result;
        try {
            result = this._decoder.decodeData(input);
        } catch (error) {
            logger.info('Failed to decode data, txid: %s, %s', txid, error.message);
            return [undefined, false];
        }

        if (result.name == 'transfer') {
            let to = '0x' + result.inputs[0];
            let amount = utils.fromWei(result.inputs[1].toString(), decimals);
            return [{symbol: token.symbol, from: null, to: to, amount: amount}, true];
        } else if (result.name == 'transferFrom') {
            let from = '0x' + result.inputs[0];
            let to = '0x' + result.inputs[1];
            let amount = utils.fromWei(result.inputs[2].toString(), decimals);
            return [{symbol: token.symbol, from: from, to: to, amount: amount}, true];
        }
        return [undefined, false];
    }
}

module.exports = Poller;
