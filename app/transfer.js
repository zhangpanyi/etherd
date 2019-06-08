const BN = require('bn.js');
const Tx = require('ethereumjs-tx');
const abi = require('./abi');
const Audit = require('./audit');
const Nonce = require('./nonce');
const Transactions = require('./transactions');
const utils = require('./common/utils');
const logger = require('./common/logger');
const future = require('./common/future');
const Waitgroup = require('./common/waitgroup');
const geth = require('../config/geth');

class Transfer {
    constructor(web3){
        this._web3 = web3;
        this._transactions = new Transactions();
        this._nonce = new Nonce(web3, this._transactions);
        this._audit = new Audit(web3, this._transactions, this._nonce);
        this._audit.startPolling();
    }

    // 发送原始交易
    async sendRawTransaction(data, from, privateKey) {
        // 构造消息
        let web3 = this._web3;
        let error, gasPrice, nonce, callback;
        [error, gasPrice] = await future(web3.eth.getGasPrice());
        if (error != null) {
            logger.error('Failed to send raw transaction, %s', error.message);
            throw error;
        }
        [error, [nonce, callback]] = await future(this._nonce.getNonce(from));
        if (error != null) {
            logger.error('Failed to send token, %s', error.message);
            throw error;
        }
        let rawTransaction = {
            from        : from,
            nonce       : web3.utils.toHex(nonce),
            gasLimit    : web3.utils.toHex(web3.utils.toHex(geth.rawTxGasLimit)),
            gasPrice    : web3.utils.toHex(gasPrice),
            data        : data,
        };

        // 签名消息
        let input;
        [error, input] = await future(this._signTransaction(rawTransaction, privateKey));
        if (error != null) {
            logger.error('Failed to sign message, %s', error.message);
            callback(false);
            throw error;
        }

        // 发送签名消息
        let txid = null;
        let waitgroup = new Waitgroup(1);
        web3.eth.sendSignedTransaction(input).once('transactionHash', function(hash) {
            txid = hash;
            waitgroup.done();
        }).on('error', function(err) {
            error = err;
            waitgroup.done();
        })
        await waitgroup.wait();
        if (error != null) {
            logger.error('Failed to send raw transaction, %s', error.message);
            callback(false);
            throw error;
        }

        await future(this._transactions.updateTx(from, txid, nonce));
        callback(true);

        logger.warn('Send raw transaction, hash: %s', txid);
        return txid;
    }

    // 发送eth代币
    async sendToken(from, to, amount, privateKey) {
        // 检查余额
        let error, balance;
        let web3 = this._web3;
        [error, balance] = await future(web3.eth.getBalance(from, 'latest'));
        if (error != null) {
            logger.error('Failed to send token, getBalance, %s', error.message);
            throw error;
        }
        let toAmount = web3.utils.toWei(amount);
        let cmpret = new BN(toAmount, 10).cmp(new BN(balance, 10));
        if (cmpret == 0 || cmpret == 1) {
            error = new Error('Insufficient coins');
            logger.error('Failed to send token, %s', error.message);
            throw error;
        }
     
        // 构造消息
        let gasPrice, nonce, callback;
        [error, gasPrice] = await future(web3.eth.getGasPrice());
        if (error != null) {
            logger.error('Failed to send token, %s', error.message);
            throw error;
        }
        [error, [nonce, callback]] = await future(this._nonce.getNonce(from));
        if (error != null) {
            logger.error('Failed to send token, %s', error.message);
            throw error;
        }
        let rawTransaction = {
            from:       from,
            to:         to,
            nonce:      nonce,
            gasLimit:   web3.utils.toHex(geth.gasLimit),
            gasPrice:   web3.utils.toHex(gasPrice),
            value:      web3.utils.toHex(toAmount)
        };

        // 签名消息
        let input;
        [error, input] = await future(this._signTransaction(rawTransaction, privateKey));
        if (error != null) {
            logger.error('Failed to sign message, %s', error.message);
            callback(false);
            throw error;
        }

        // 发送签名消息
        let txid = null;
        let waitgroup = new Waitgroup(1);
        web3.eth.sendSignedTransaction(input).once('transactionHash', function(hash) {
            txid = hash;
            waitgroup.done();
        }).on('error', function(err) {
            error = err;
            waitgroup.done();
        })
        await waitgroup.wait();
        if (error != null) {
            logger.error('Failed to send token, %s', error.message);
            callback(false);
            throw error;
        }

        await future(this._transactions.updateTx(from, txid, nonce));
        callback(true);

        logger.warn('Transfer %s ETH from %s to %s, hash: %s, nonce: %s', amount, from, to, txid, nonce);
        return txid;
    }

    // 发送ERC20代币
    async sendERC20Token(symbol, contractAddress, decimals, from, to, amount, privateKey) {
        // 构造合约
        let error, balance;
        let web3 = this._web3;
        let toAmount = utils.toWei(amount, decimals);
        let contract = new web3.eth.Contract(abi, contractAddress);

        // 检查余额
        [error, balance] = await future(contract.methods.balanceOf(from).call());
        if (error != null) {
            logger.error('Failed to send ERC20 token, balanceOf, %s', error.message);
            throw error;
        }

        let cmpret = new BN(toAmount, 10).cmp(new BN(balance, 10));
        if (cmpret == 1) {
            error = new Error('Insufficient coins');
            logger.error('Failed to send ERC20 token, %s', error.message);
            throw error;
        }

        // 构造消息
        let gasPrice, nonce, callback;
        [error, gasPrice] = await future(web3.eth.getGasPrice());
        if (error != null) {
            logger.error('Failed to send ERC20 token, %s', error.message);
            throw error;
        }
        [error, [nonce, callback]] = await future(this._nonce.getNonce(from));
        if (error != null) {
            logger.error('Failed to send token, %s', error.message);
            throw error;
        }
       
        let rawTransaction = {
            from        : from,
            to          : contractAddress,
            nonce       : nonce,
            gasLimit    : web3.utils.toHex(geth.gasLimit),
            gasPrice    : web3.utils.toHex(gasPrice),
            data        : contract.methods.transfer(to, toAmount).encodeABI(),
        };

        // 签名消息
        let input;
        [error, input] = await future(this._signTransaction(rawTransaction, privateKey));
        if (error != null) {
            logger.error('Failed to sign message, %s', error.message);
            callback(false);
            throw error;
        }

        // 发送签名消息
        let txid = null;
        let waitgroup = new Waitgroup(1);
        web3.eth.sendSignedTransaction(input).once('transactionHash', function(hash) {
            txid = hash;
            waitgroup.done();
        }).on('error', function(err) {
            error = err;
            waitgroup.done();
        })
        await waitgroup.wait();
        if (error != null) {
            logger.error('Failed to send ERC20 token, %s', error.message);
            callback(false);
            throw error;
        }

        await future(this._transactions.updateTx(from, txid, nonce));
        callback(true);

        logger.warn('Transfer %s %s from %s to %s, hash: %s, nonce: %s', amount, symbol, from, to, txid, nonce);
        return txid;
    }

    // 消息签名
    async _signTransaction(rawTransaction, privateKey) {
        let tx = new Tx(rawTransaction);
        tx.sign(privateKey);
        let serializedTx = tx.serialize();  
        return '0x' + serializedTx.toString('hex');
    }

};

module.exports = Transfer;