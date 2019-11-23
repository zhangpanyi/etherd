import { Transaction } from 'ethereumjs-tx'

import { logger } from '@pkg/logger'
import { nothrow } from '@pkg/promise'
import { WaitGroup } from '@pkg/waitgroup'
import { Ether } from '@app/ether'
import { Nonce } from '@app/nonce'
import * as utils from '@app/utils'
import { TokenDao } from '@app/models/token'
import { TransactionDao } from '@app/models/transaction'

import Geth from '@configs/geth.json'

class Transfer {
    private ether: Ether
    private nonce: Nonce

    constructor(ether: Ether) {
        this.ether = ether
        this.nonce = new Nonce(ether.web3)
    }

    // 获取GAS价格
    private async getGasPrice() {
        const suggest = this.ether.poller.getGasPrice()
        let gasPrice = BigInt(await this.ether.web3.eth.getGasPrice())
        if (suggest > gasPrice) {
            gasPrice = suggest
        }
        return gasPrice.toString()
    }

    // 重新发送
    async resend(from: string, privateKey: Buffer, txHash: string) {
        let dao = new TransactionDao()
        const tx = await dao.get(from, txHash)
        if (!tx) {
            throw new Error('not found hash')
        }
        await dao.deleteByHash(from, txHash)

        const data = JSON.parse(tx.data)
        let result = await nothrow(this.sendTransaction(from, privateKey, data.to, data.value, data.data))
        if (result.data == null || result.error) {
            logger.error('[transfer] failed to resend tx, hash: %s, %s', txHash, result.error.message)
            await dao.insert(from, txHash, data)
            throw result.error
        }

        let {hash} = result.data
        await (new TokenDao).updateHash(txHash, hash)
        logger.warn('[transfer] resend transaction, old: %s, hash: %s', txHash, hash)
        return hash
    }

    // 发送ETH代币
    async sendToken(from: string, to: string, amount: string, privateKey: Buffer) {
        // 检查余额
        let balance = await nothrow(this.ether.web3.eth.getBalance(from, 'latest'))
        if (balance.data == null || balance.error) {
            logger.error('[transfer] failed to send token, getBalance, %s', balance.error.message)
            throw balance.error
        }
        let toAmount = this.ether.web3.utils.toWei(amount)
        if (BigInt(toAmount) >= BigInt(balance.data)) {
            const error = new Error('insufficient coins')
            logger.error('[transfer] failed to send token, %s', error.message)
            throw error
        }

        // 发送事务
        const value = this.ether.web3.utils.toHex(toAmount)
        let result = await nothrow(this.sendTransaction(from, privateKey, to, value, undefined))
        if (result.data == null || result.error) {
            logger.error('[transfer] failed to send token, %s', result.error.message)
            throw result.error
        }
        logger.warn('[transfer] transfer %s ETH from %s to %s, hash: %s, nonce: %s',
            amount, from, to, result.data.hash, result.data.nonce)
        return result.data.hash
    }

    // 发送ERC20代币
    async sendERC20Token(from: string, to: string, symbol: string, amount: string, privateKey: Buffer) {
        // 检查余额
        let decimals = await this.ether.getTokenDecimals(symbol)
        let contract = await this.ether.getContract(symbol)
        let balance = await nothrow(contract.methods.balanceOf(from).call())
        if (balance.data == null || balance.error != null) {
            logger.error('[transfer] failed to send ERC20 token, balanceOf, %s', balance.error)
            throw balance.error
        }

        let toAmount = utils.toWei(amount, decimals)
        if (BigInt(toAmount) >= BigInt(balance.data)) {
            const error = new Error('insufficient coins')
            logger.error('[transfer] failed to send ERC20 token, %s', error.message)
            throw error
        }

        // 发送事务
        const data = contract.methods.transfer(to, toAmount).encodeABI()
        let result = await nothrow(this.sendTransaction(from, privateKey, to, undefined, data))
        if (result.data == null || result.error) {
            logger.error('[transfer] failed to send ERC20 token, %s', result.error.message)
            throw result.error
        }
        logger.warn('[transfer] transfer %s %s from %s to %s, hash: %s, nonce: %s',
            amount, symbol, from, to, result.data.hash, result.data.nonce)
        return result.data.hash
    }

    // 发送原始事务
    async sendTransaction(from: string, privateKey: Buffer, to: string|undefined, value: string|undefined, data: string|undefined) {
        // 获取GAS价格
        let gasPrice = await nothrow(this.getGasPrice())
        if (gasPrice.data == null || gasPrice.error) {
            throw gasPrice.error
        }
 
        // 生成Nonce序列
        let nonce = await nothrow(this.nonce.alloc(from))
        if (nonce.data == null || nonce.error) {
            throw nonce.error
        }

        // 构造事务消息
        let rawTransaction: Object = {}
        try {
            rawTransaction = {
                from: from,
                to: to,
                data: data,
                value: value,
                nonce: nonce.data.nonce,
                gasLimit: this.ether.web3.utils.toHex(Geth.gasLimit),
                gasPrice: this.ether.web3.utils.toHex(gasPrice.data)
            }
        } catch (error) {
            nonce.data.consume(false)
            throw error
        }

        // 签名事务消息
        let input: string = ''
        try {
            input = this.signTransaction(rawTransaction, privateKey)
        } catch (error) {
            nonce.data.consume(false)
            throw error
        }

        // 发送签名消息
        let error: any = null
        let hash: string = ''
        let waitGroup = new WaitGroup(1)
        this.ether.web3.eth.sendSignedTransaction(input).once('transactionHash', function(receipt: string) {
            hash = receipt
            waitGroup.done()
        }).on('error', function(err) {
            error = err
            waitGroup.done()
        })
        await waitGroup.wait()
        if (error != null) {
            nonce.data.consume(false)
            throw error
        }

        // 保存事务信息
        const dao = new TransactionDao()
        await nothrow(dao.insert(from, hash, rawTransaction))
        nonce.data.consume(true)
        return {hash, nonce: nonce.data.nonce, raw: rawTransaction}
    }

    // 签名事务消息
    private signTransaction(rawTransaction: Object, privateKey: Buffer) {
        let tx = new Transaction(rawTransaction, {chain: this.ether.network})
        tx.sign(privateKey)
        let serializedTx = tx.serialize()  
        return '0x' + serializedTx.toString('hex')
    }
}

export { Transfer }
