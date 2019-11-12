import { Transaction } from 'web3-core/types';
const InputDataDecoder = require('ethereum-input-data-decoder');

import { logger } from '@pkg/logger';
import { nothrow, sleep } from '@pkg/promise';
import { ABI } from '@app/contract/abi';
import { fromWei } from '@app/utils';
import { Ether, Token } from '@app/ether';
import { BlockDao } from '@app/models/block';
import { postNotify, Message } from '@app/notify';

import Geth from '@configs/geth.json';

class Poller {
    private ether: Ether;
    private decoder: any;
    private started = false;
    private gasPrice = BigInt(0);
    private lastBlockNumber: number = 0;

    constructor(ether: Ether) {
        this.ether = ether;
        this.decoder = new InputDataDecoder(ABI);
        this.startPolling();
    }

    // 汽油价格
    getGasPrice() {
        return this.gasPrice;
    }

    // 开始轮询
    async startPolling() {
        if (this.started) {
            return;
        }
        this.started = true;
        let dao = new BlockDao();
        const record =  await dao.createOrFirst();
        this.lastBlockNumber = record.heigth;

        while (this.started) {
            if (!await this.parseNextBlock()) {
                await sleep(1000);
            }
        }
    }

    // 解析区块
    async parseNextBlock() {
        // 获取区块数量
        let blockNumber = await nothrow(this.ether.web3.eth.getBlockNumber());
        if (blockNumber.data == null || blockNumber.error) {
            logger.info('[poller] failed to call `getBlockNumber`, %s', blockNumber.error.message);
            return false;
        }

        const blockNum = blockNumber.data - Geth.confirmations;
        if (blockNum < this.lastBlockNumber) {
            return false;
        }
        if (this.lastBlockNumber == 0) {
            this.lastBlockNumber = blockNum;
        }
        logger.debug('[poller] current reading block number: %d', this.lastBlockNumber);

        // 获取区块信息
       let block = await nothrow(this.ether.web3.eth.getBlock(this.lastBlockNumber, true));
        if (block.data == null || block.error) {
            logger.info('[poller] failed to call `getBlock`, %s', block.error.message);
            return false;
        }
        
        // 计算汽油价格
        this.calculGasPrice(block.data.transactions as Transaction[]);

        // 解析交易信息
        let result = await nothrow(this.parseTransactions(block.data.transactions as Transaction[]));
        if (result.error) {
            logger.info('[poller] failed to parse transactions, %s', result.error.message);
            return false;
        }

        // 更新区块高度
        this.lastBlockNumber += 1;
        let dao = new BlockDao();
        await dao.update(this.lastBlockNumber);
        return true;
    }

    // 计算汽油价格
    calculGasPrice(transactions: Transaction[]) {
        let gasPrices = new Array<bigint>();
        for (let idx in transactions) {
            const transaction = transactions[idx];
            gasPrices.push(BigInt(transaction.gasPrice));
        }
        if (gasPrices.length == 0) {
            return;
        }

        gasPrices.sort();
        const index = parseInt((gasPrices.length / 2).toFixed(0));
        const mid = gasPrices[index];
        const sum = gasPrices.reduce((acc, val) => acc+val, BigInt(0));
        const avg =  sum / BigInt(gasPrices.length);
        this.gasPrice = mid > avg ? avg : mid;
    }

    // 解析交易列表
    async parseTransactions(transactions: Transaction[]) {
        for (let idx = 0; idx < transactions.length;) {
            const transaction = transactions[idx];
            if (transaction.to == null) {
                idx++;
                continue;
            }

            // 获取代币信息
            let token = await this.ether.getToken('ETH');
            if (token == null) {
                idx++;
                continue;
            }

            // 构造转账信息
            let message: Message = {
                type: 'transaction',
                symbol: 'ETH',
                from: transaction.from,
                to: '',
                hash: transaction.hash,
                amount: '0',
                blockNumber: transaction.blockNumber,
            };

            // 解析转账信息
            if (this.ether.isMineAccount(transaction.to)) {
                message.to = transaction.to.toLowerCase();
                message.amount = this.ether.web3.utils.fromWei(transaction.value);
            } else {
                token = await this.ether.getTokenByContract(transaction.to);
                if (token == null) {
                    idx++;
                    continue;
                }
                
                let transfer = await nothrow(
                    this.parseContractTransfer(transaction.hash, token, transaction.input));
                if (transfer.data == null || transfer.error) {
                    logger.info('[poller] failed to read contract transfer, %s', transfer.error.message);
                    continue;
                }

                if (!transfer.data.ok) {
                    idx++;
                    continue;
                }

                message.symbol = transfer.data.symbol as string;
                if (transfer.data.from == null) {
                    message.from = transaction.from.toLowerCase();
                }
                message.to = (transfer.data.to as string).toLowerCase();
                message.amount = transfer.data.amount as string;
            }

            // 发送收款通知
            idx++;
            if (!this.ether.isMineAccount(message.to)) {
                if (this.ether.isMineAccount(message.from)) {
                    this.ether.wallet.refreshBalance(message.from, message.symbol);
                }
                continue;
            }
            const fromWallet = this.ether.isMineAccount(message.from);
            this.ether.wallet.refreshBalance(message.to, message.symbol);
            if (!fromWallet) {
                logger.warn('[poller] transfer has been received, from: %s, to: %s, symbol: %s, amount: %s, hash: %s',
                    message.from, message.to, message.symbol, message.amount, message.hash);
                postNotify(token.notify, message);
            } else if (token.contractAddress && token.contractAddress != message.from) {
                logger.warn('[poller] transfer has been received but ignore, from: %s, to: %s, symbol: %s, amount: %s, hash: %s',
                    message.from, message.to, message.symbol, message.amount, message.hash);
            }
        }
    }

    // 解析合约转账
    async parseContractTransfer(hash: string, token: Token, input: string) {
        let decimals = await nothrow(this.ether.getTokenDecimals(token.symbol));
        if (decimals.data == null || decimals.error) {
            logger.info('[poller] failed to get decimals, txid: %s, %s', hash, decimals.error.message);
            return {ok: false};
        }

        let result: any;
        try {
            result = this.decoder.decodeData(input);
        } catch (error) {
            logger.info('[poller] failed to decode data, txid: %s, %s', hash, error.message);
            return {ok: false};
        }

        if (result.method == 'transfer') {
            let to = '0x' + result.inputs[0];
            let amount = fromWei(result.inputs[1].toString(), decimals.data);
            return {ok: true, symbol: token.symbol, from: null, to: to, amount: amount};
        } else if (result.method == 'transferFrom') {
            let from = '0x' + result.inputs[0];
            let to = '0x' + result.inputs[1];
            let amount = fromWei(result.inputs[2].toString(), decimals.data);
            return {ok: true, symbol: token.symbol, from: from, to: to, amount: amount};
        }
        return {ok: false};
    }
}

export { Poller };
