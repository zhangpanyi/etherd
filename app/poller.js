const abi = require('./abi');
const Notify = require('./notify');
const Latest = require('./latest');
const geth = require('../config/geth');
const utils = require('./common/utils');
const logger = require('./common/logger');
const future = require('./common/future');
const InputDataDecoder = require('ethereum-input-data-decoder');

class Poller {
    constructor(ethereum, web3) {
        this._web3 = web3;
        this._ethereum = ethereum;
        this._decoder = new InputDataDecoder(abi);
        this._lastBlockNumber = Latest.getHeigth();
    }

    // 解析区块
    async parseNextBlock() {
        // 获取区块高度
        let web3 = this._web3;
        let error, blockNumber, block;
        [error, blockNumber] = await future(web3.eth.getBlockNumber());
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
        [error, block] = await future(web3.eth.getBlock(this._lastBlockNumber, true));
        if (error != null) {
            logger.info('Failed to call `getBlock`, %s', error.message);
            return false;
        }

        // 解析交易信息
        let result;
        [error, result] = await future(this._parseTransactions(block.transactions));
        if (error != null) {
            logger.info('Failed to parse transactions, %s', error.message);
            return false;
        }

        Latest.updateHeigth(this._lastBlockNumber);
        this._lastBlockNumber += 1;
        return true;
    }

    // 获取通知地址
    _getWalletNotify(contractAddress) {
        let token = this._ethereum.findTokenByAddress(contractAddress);
        if (token) {
            return token.notify;
        }
        return null;
    }

    // 获取合约转账
    async _readContractTransfer(contractAddress, input) {
        if (contractAddress == null) {
            return [undefined, false];
        }

        // 获取token信息
        let token = this._ethereum.findTokenByAddress(contractAddress);
        if (!token) {
            return [undefined, false];
        }

        // 获取代币精度
        let error, decimals;
        [error, decimals] = await future(this._ethereum.getDecimals(token.symbol));
        if (error) {
            logger.info('Failed to get decimals, %s', error.message);
            return [undefined, false];
        }

        // 获取转账信息
        const result = this._decoder.decodeData(input);
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

    // 解析交易列表
    async _parseTransactions(transactions) {
        let web3 = this._web3;
        let error, transaction;
        let token = await this._ethereum.findToken('ETH');
        for (let i = 0; i < transactions.length;) {
            transaction = transactions[i];

            // 构造交易信息
            let notify = new Notify();
            notify.from = transaction.from;
            notify.hash = transaction.hash;   
            notify.blockNumber = transaction.blockNumber;
            if (transaction.to && this._ethereum.isMineAccount(transaction.to)) {
                // 更新余额
                if (this._ethereum.isMineAccount(transaction.to)) {
                    this._ethereum.updateWalletBalances(transaction.to, 'ETH');
                }
                if (this._ethereum.isMineAccount(transaction.from)) {
                    this._ethereum.updateWalletBalances(transaction.from, 'ETH');
                }

                // 筛除转账
                if (transaction.from.toLowerCase() == token.address.toLowerCase()) {
                    i++;
                    continue;
                }

                // 普通转账
                notify.symbol = 'ETH';
                notify.to = transaction.to.toLowerCase();
                notify.amount = web3.utils.fromWei(transaction.value);
                logger.warn('Transfer has been received, from: %s, to: %s, symbol: %s, amount: %s, txid: %s',
                    notify.from, notify.to, notify.symbol, notify.amount, notify.hash);
                notify.post(token.notify);
            } else {
                // 合约转账
                let info, ok;
                [error, [info, ok]] = await future(this._readContractTransfer(transaction.to, transaction.input));
                if (error) {
                    logger.info('Failed to read contract transfer, %s', error.message);
                    continue;
                }

                if (ok) {
                    if (info.from == null) {
                        info.from = transaction.from;
                    }

                    // 更新余额
                    if (this._ethereum.isMineAccount(info.to)) {
                        this._ethereum.updateWalletBalances(info.to, info.symbol);
                    }
                    if (this._ethereum.isMineAccount(info.from)) {
                        this._ethereum.updateWalletBalances(info.from, info.symbol);
                    }

                    // 回调通知
                    if (this._ethereum.isMineAccount(info.to)) {
                        if (info.from != null) {
                            notify.from = info.from;
                        }
                        notify.symbol = info.symbol;
                        notify.to = info.to.toLowerCase();
                        notify.amount = info.amount;
                        logger.warn('Transfer has been received, from: %s, to: %s, symbol: %s, amount: %s, txid: %s',
                            notify.from, notify.to, notify.symbol, notify.amount, notify.hash);
                        notify.post(this._getWalletNotify(transaction.to));
                    }      
                }
            }
            i++;
        }
    }
}

module.exports = Poller;
