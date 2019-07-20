const Web3 = require('web3');

const abi = require('./abi');
const Tokens = require('./tokens');
const EIP20 = require('./eip20');
const Poller = require('./poller');
const Notify = require('./notify');
const Accounts = require('./accounts');
const Transfer = require('./transfer');
const Balances = require('./balances');

const utils = require('./common/utils');
const sleep = require('./common/sleep');
const logger = require('./common/logger');
const nothrow = require('./common/nothrow');

const geth = require('../config/geth');
const tokens = require('../config/tokens');

class Ethereum {
    constructor() {
        // 私有变量
        this._eth = null;
        this._tokens = {};
        this._acounts = null;
        this._started = false;
        this._web3 = new Web3();
        this._contracts = new Map();
        this._eip20 = new EIP20('contract/token/EIP20');

        // 初始ETH配置
        this._eth = tokens.ETH;
        this._eth.symbol = 'ETH';
        this._web3.setProvider(new Web3.providers.HttpProvider(geth.endpoint));
        [this._eth.privateKey, this._eth.address] = utils.readPrivateKey(this._eth.keystore, this._eth.unlockPassword);

        // 初始ERC20配置
        for (let key in tokens) {
            if (key != 'ETH') {
                let token = tokens[key];
                token.symbol = key;
                if (token.keystore === this._eth.keystore) {
                    token.address = this._eth.address;
                    token.privateKey = this._eth.privateKey;
                } else {
                    [token.privateKey, token.address] = utils.readPrivateKey(token.keystore, token.unlockPassword);
                }
                this._tokens[key] = token;
            }
        }

        // 创建token存储
        this._store = new Tokens();

        // 创建账户管理
        this._acounts = new Accounts('keystore');

        // 创建轮询模块
        this._poller = new Poller(this, this._web3);

        // 创建转账模块
        this._transfer = new Transfer(this._poller, this._web3);

        // 创建钱包余额缓存
        this._balances = new Balances(this);
    }

    // 开始轮询
    async startPoll() {
        if (this._started) {
            return;
        }
        this._started = true;
        this._poller.startPoll();

        let web3 = this._web3;
        while (this._started) {
            let txs = await this._store.asyncGetPendingTx();
            for (let idx in txs) {
                let error, tx;
                let txid = txs[idx].txid;
                [error, tx] = await nothrow(web3.eth.getTransactionReceipt(txid));
                if (error != null || tx == null) {
                    continue;
                }

                if (!tx.status) {
                    await this._store.asyncUpdateReceipt(txid, null, false);
                } else {
                    let contractAddress = tx.contractAddress.toLowerCase();
                    await this._store.asyncUpdateReceipt(txid, contractAddress, true);
                    logger.warn('Deploy ERC20 token success, symbol: %s, contractAddress: %s, txid: %s',
                        txs[idx].symbol, contractAddress, txid);

                    let notify = new Notify();
                    notify.from         = txs[idx].owner;
                    notify.hash         = txid;   
                    notify.blockNumber  = tx.blockNumber;
                    notify.symbol       = txs[idx].symbol;
                    notify.to           = txs[idx].owner;
                    notify.amount       = utils.fromWei(txs[idx].initialAmount, txs[idx].decimals);

                    let token = await this.asyncFindToken(txs[idx].symbol);
                    notify.post(token.notify);
                }
            }
            await sleep(1000 * 10);
       }
    }

    // 创建账户
    newAccount() {
        return this._acounts.create();
    }

    // 获取账户列表
    getAccounts() {
        return this._acounts.getAccounts();
    }

    // 获取智能合约
    getContract(token) {
        if (this._contracts.has(token.symbol)) {
            return this._contracts.get(token.symbol)
        }
        let contract = new this._web3.eth.Contract(abi, token.contractAddress);
        this._contracts.set(token.symbol, contract);
        return contract;
    }

    // 钱包余额
    get walletBalance() {
        return this._balances;
    }

    // 是否我的账户
    isMineAccount(address) {
        return this._acounts.has(address);
    }

    // 获取符号列表
    async asyncGetSymbols() {
        let symbols = ['ETH'];
        for (let symbol in this._tokens) {
            symbols.push(symbol);
        }

        let error, txs;
        [error, txs] = await nothrow(this._store.asyncGetCompletedTx());
        if (error != null) {
            return symbols;
        }
        for (let idx in txs) {
            symbols.push(txs[idx].symbol);
        }
        return symbols;
    }

    // 查找代币配置
    async asyncFindToken(symbol) {
        if (symbol.toUpperCase() == 'ETH') {
            return this._eth;
        }

        for (let key in this._tokens) {
            if (key === symbol.toUpperCase()) {
                const token = this._tokens[key];
                return token;
            }
        }

        let error, txs;
        [error, txs] = await nothrow(this._store.asyncGetCompletedTx());
        if (error != null) {
            return null;
        }

        for (let idx in txs) {
            if (symbol.toUpperCase() == txs[idx].symbol.toUpperCase()) {
                let token = {
                    symbol:             txs[idx].symbol,
                    address:            this._eth.address,
                    privateKey:         this._eth.privateKey,
                    contractAddress:    txs[idx].contractAddress,
                    notify:             this._eth.notify,
                }
                this._tokens[symbol] = token;
                return token;
            }
        }
        return null;
    }

    // 根据合约地址查找代币配置
    async asyncFindTokenByAddress(contractAddress) {
        for (let key in this._tokens) {
            const token = this._tokens[key];
            if (contractAddress.toLowerCase() == token.contractAddress.toLowerCase()) {
                return token;
            }
        }

        let error, txs;
        [error, txs] = await nothrow(this._store.asyncGetCompletedTx());
        if (error != null) {
            return null;
        }

        for (let idx in txs) {
            if (contractAddress.toUpperCase() == txs[idx].contractAddress.toUpperCase()) {
                let token = {
                    symbol:             txs[idx].symbol,
                    address:            this._eth.address,
                    privateKey:         this._eth.privateKey,
                    contractAddress:    txs[idx].contractAddress,
                    notify:             this._eth.notify,
                }
                this._tokens[symbol] = token;
                return token;
            }
        }
        return null;
    }

    // 获取代币精度
    async asyncGetDecimals(symbol) {
        // 查找代币信息
        let token = await this.asyncFindToken(symbol);
        if (!token) {
            throw new Error('Not found token.')
        }
        if (token.decimals) {
            return token.decimals;
        }

        // 查询代币精度
        let error, decimals;
        let contract = this.getContract(token);
        [error, decimals] = await nothrow(contract.methods.decimals().call());
        if (error != null) {
            throw error;
        }
        token.decimals = decimals;
        return decimals;
    }

    // 获取账户余额
    async asyncGetBalance(address, symbol) {
        let error, balance;
        let web3 = this._web3;
        if (symbol.toUpperCase() == 'ETH') {
            [error, balance] = await nothrow(web3.eth.getBalance(address, 'latest'));
            if (error != null) {
                throw error;
            }
            return web3.utils.fromWei(balance);
        }

        let token = await this.asyncFindToken(symbol);
        if (token == null) {
            throw new Error('Unknown token symbol.');
        }

        let decimals;
        [error, decimals] = await nothrow(this.asyncGetDecimals(symbol));
        if (error != null) {
            throw error;
        } 

        let contract = this.getContract(token);
        [error, balance] = await nothrow(contract.methods.balanceOf(address).call());
        if (error != null) {
            throw error;
        }
        return utils.fromWei(balance, decimals);
    }

    // 重发交易
    async asyncResend(address, txid) {
        let ok = false;
        let privateKey;
        if (address.toLocaleLowerCase() === this._eth.address) {
            privateKey = this._eth.privateKey;
        } else {
            [privateKey, ok] = this._acounts.getPriveteKey(address);
            if (!ok) {
                throw  new Error('Account not authorized.');
            }
        }

        let error, hash;
        [error, hash] = await nothrow(this._transfer.asyncResend(
            address, txid, privateKey));
        if (error != null) {
            throw error;
        }
        return hash;
    }
    
    // 发送代币
    async asyncSendTokenFrom(from, to, amount, privateKey) {
        if (!privateKey) {
            let ok = false;
            [privateKey, ok] = this._acounts.getPriveteKey(from);
            if (!ok) {
                throw  new Error('Account not authorized.');
            }
        }

        let error, hash;
        [error, hash] = await nothrow(this._transfer.asyncSendToken(
            from, to, amount, privateKey));
        if (error != null) {
            throw error;
        }
        return hash;
    }

    async asyncSendToken(to, amount) {
        return this.asyncSendTokenFrom(this._eth.address, to, amount, this._eth.privateKey);
    }

    // 发送ERC20代币
    async asyncSendERC20TokenFrom(symbol, from, to, amount, privateKey) {
        // 查找代币信息
        let token = await this.asyncFindToken(symbol);
        if (token == null) {
            throw new Error('Unknown token symbol.');
        }

        // 获取代币精度
        let error, decimals, hash;
        [error, decimals] = await nothrow(this.asyncGetDecimals(symbol));
        if (error != null) {
            throw error;
        }

        // 获取地址私钥
        if (!privateKey) {
            let ok = false;
            [privateKey, ok] = this._acounts.getPriveteKey(from);
            if (!ok) {
                throw  new Error('Account not authorized.');
            }
        }

        // 发送ERC20代币
        let contract = this.getContract(token);
        [error, hash] = await nothrow(this._transfer.asyncSendERC20Token(
            symbol, contract, decimals, from, to, amount, privateKey));
        if (error != null) {
            throw error;
        }
        return hash;
    }

    async asyncSendERC20Token(symbol, to, amount) {
        let token = await this.asyncFindToken(symbol);
        if (token == null) {
            throw new Error('Unknown token symbol.');
        }
        return this.asyncSendERC20TokenFrom(symbol, token.address, to, amount, token.privateKey);
    }

    // 部署ERC20代币合约
    async asyncDeployERC20Token(owner, initialAmount, name, decimals, symbol) {
        let error, hash;
        if (owner == '') {
            owner = this._eth.address;
        }

        let token =  await this.asyncFindToken(symbol);
        if (token != null) {
            throw new Error('Symbol already exists.');
        }

        let deploy = this._eip20.deploy(owner, initialAmount, name, decimals, symbol);
        [error, hash] = await nothrow(
            this._transfer.asyncSendRawTransaction(deploy, this._eth.address, this._eth.privateKey));
        if (error != null) {
            throw error;
        }
        if (owner == this._eth.address) {
            await this._store.asyncInsertTx(owner, initialAmount, name, decimals, symbol, hash);
        }
        return hash;
    }
}

module.exports = Ethereum;
