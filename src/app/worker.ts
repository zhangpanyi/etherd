import { BigNumber } from 'bignumber.js'

import { Ether } from '@app/ether'
import { logger } from '@pkg/logger'
import { sleep, nothrow } from '@pkg/promise'

import { ToDo, ToDoDao, Type } from '@app/models/todo'

class Worker {
    private ether: Ether;

    constructor(ether: Ether) {
        this.ether = ether;
    }

    // 开始作业
    async start() {
        let dao = new ToDoDao()
        while (true) {
            try {
                let todo = await dao.first()
                if (todo == null) {
                    await sleep(5000)
                    continue
                }
                if (todo.type == Type.SendFee) {
                    await this.handleSendFee(todo)
                } else if (todo.type == Type.Collect) {
                    await this.handleCollect(todo)
                } else {
                    dao.setDone(todo.id, 0)
                }
            } catch (error) {  
                logger.warn('[worker] failed to handle Todo, %s', error.message)  
            }
        }
    }

    // 获取手续费
    private async getFee() {
        return new BigNumber('0.0005')
    }

    // 处理资金归集
    private async handleCollect(todo: ToDo) {
        let params = JSON.parse(todo.params)
        let ethBalances = new Map<string, string>()
        const balances = this.ether.wallet.getBalances(params.symbol)
        if (params.symbol === 'ETH') {
            ethBalances = balances
        } else {
            ethBalances = this.ether.wallet.getBalances('ETH')
        }

        let count = 0
        let fee = await this.getFee()
        let minBalance = new BigNumber(params.minBalance)

        const token = await this.ether.getToken('ETH')
        if (token == null) {
            new ToDoDao().setDone(todo.id as number, count)
            return
        }

        for (let [address, balance] of balances) {
            const eth = ethBalances.get(address)
            if (eth && new BigNumber(eth).comparedTo(fee) <= 0) {
                continue
            }

            if (new BigNumber(balance).comparedTo(minBalance) < 0) {
                continue
            }

            let hash = ''
            const amount = new BigNumber(balance).minus(fee).toString(10)
            if (params.symbol === 'ETH') {
                let result = await nothrow(this.ether.sendTokenFrom(
                    address, token.walletAddress, amount, undefined))
                if (result.data == null || result.error) {
                    logger.warn('[worker] failed to fund collection, from: %s, %s', address, result.error.message)
                    break
                }
                hash = result.data
            } else {
                let result = await nothrow(this.ether.sendERC20TokenFrom(
                    params.symbol, address, token.walletAddress, amount, undefined))
                if (result.data == null || result.error) {
                    logger.warn('[worker] failed to fund collection, from: %s, %s', address, result.error.message)
                    break
                }
                hash = result.data
            }
            count++
            logger.info('[worker] fund collection(%s %s) from %s to %s, hash: %s',
                balance, params.symbol, address, token.walletAddress, hash)

            if (count > 0 && count % 50 == 0) {
                logger.info('[worker] fund collection transaction too many, count: %s, sleep...', count)
                await sleep(1000 * 60 * 10)
            }
        }
        new ToDoDao().setDone(todo.id as number, count)
    }

    // 处理发送手续费
    private async handleSendFee(todo: ToDo) {
        let params = JSON.parse(todo.params)
        let ethBalances = new Map<string, string>()
        const balances = this.ether.wallet.getBalances(params.symbol)
        if (params.symbol === 'ETH') {
            ethBalances = balances
        } else {
            ethBalances = this.ether.wallet.getBalances('ETH')
        }

        let count = 0
        let fee = await this.getFee()
        let minBalance = new BigNumber(params.minBalance)
        for (let [address, balance] of balances) {
            const eth = ethBalances.get(address)
            if (eth && new BigNumber(eth).comparedTo(fee) >= 0) {
                continue
            }

            if (new BigNumber(balance).comparedTo(minBalance) < 0) {
                continue
            }

            let hash = ''
            if (params.symbol === 'ETH') {
                let result = await nothrow(this.ether.sendToken(address, fee.toString(10)))
                if (result.data == null || result.error) {
                    logger.warn('[worker] failed to send fee, %s', result.error.message)
                    break
                }
                hash = result.data
            } else {
                let result = await nothrow(this.ether.sendERC20Token(params.symbol, address, fee.toString(10)))
                if (result.data == null || result.error) {
                    logger.warn('[worker] failed to send fee, %s', result.error.message)
                    break
                }
                hash = result.data
            }
            count++
            logger.info('[worker] send fee(%s ETH) to %s, hash: %s', fee.toString(), address, hash)

            if (count > 0 && count % 50 == 0) {
                logger.info('[worker] send fee transaction too many, count: %s, sleep...', count)
                await sleep(1000 * 60 * 10)
            }
        }

        let dao = new ToDoDao()
        dao.setDone(todo.id as number, count)
    }
}

export { Worker }
