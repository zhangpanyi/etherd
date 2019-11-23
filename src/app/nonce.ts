import Web3 from 'web3'
import { sleep, nothrow } from '@pkg/promise'
import { TransactionDao } from '@app/models/transaction'

interface Status {
    nonce: number
    locked: boolean
}

class Nonce {
    private web3: Web3
    private table: Map<string, Status>

    constructor(web3: Web3) {
        this.web3 = web3
        this.table = new Map<string, Status>()
    }

    async alloc(account: string) {
        await this.ensure(account)
        if (!this.table.has(account)) {
            throw new Error('alloc failed')
        }

        while ((this.table.get(account) as Status).locked) {
            await sleep(100)
        }

        let status = this.table.get(account) as Status
        status.locked = true
        this.table.set(account, status)

        let self = this
        let consume = function(success: boolean) {
            let status = self.table.get(account) as Status
            if (success) {
                status.nonce++
            }
            status.locked = false
            self.table.set(account, status)
        }
        return {nonce: status.nonce, consume}
    }

    async free(account: string, nonce: number) {
        await this.ensure(account)
        while ((this.table.get(account) as Status).locked) {
            await sleep(100)
        }

        let status = this.table.get(account) as Status
        status.nonce = nonce
        status.locked = true
        this.table.set(account, status)

        const dao = new TransactionDao()
        await nothrow(dao.deleteByNonce(account, nonce))
        status.locked = false
        this.table.set(account, status)
    }

    private async ensure(account: string) {
        if (this.table.has(account)) {
            return
        }

        const dao = new TransactionDao()
        let count = await this.web3.eth.getTransactionCount(account, 'latest')
        const transactions = await dao.top(account, 0, 1)
        if (transactions.length > 0 && transactions[0].nonce >= count) {
            count = transactions[0].nonce + 1
        }
        if (!this.table.has(account)) {
            this.table.set(account, {nonce: count, locked: false})
        }
    }
}

export { Nonce }
