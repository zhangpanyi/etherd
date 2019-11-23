import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'

import { nothrow } from '@pkg/promise'
import { ABI } from '@app/contract/abi'
import { EIP20 } from '@app/contract/eip20'
import { Audit } from '@app/audit'
import { Poller } from '@app/poller'
import { Accounts } from '@app/accounts'
import { Transfer } from '@app/transfer'
import { WalletManager } from '@app/wallet'
import { readPrivateKey, fromWei, toWei } from '@app/utils'
import * as tokenModel from '@app/models/token'

import Tokens from '@configs/tokens.json'
import { TransactionDao } from './models/transaction'

interface Token {
    symbol: string
    walletAddress: string
    contractAddress: string | undefined
    decimals: number | undefined
    privateKey: Buffer
    notify: null | undefined | string
}

class Ether {
    public web3: Web3
    public network: string
    public poller: Poller
    public wallet: WalletManager
    private eip20: EIP20
    private audit: Audit
    private accounts: Accounts
    private transfer: Transfer
    private tokens: Array<Token>
    private contracts: Map<string, Contract>

    constructor(web3: Web3, network: string) {
        this.web3 = web3
        this.network = network
        this.accounts = new Accounts()
        this.tokens = this.parseToekns(Tokens)
        this.contracts = new Map<string, Contract>()
        this.eip20 = new EIP20('contract/token/EIP20')
        this.audit = new Audit(web3)
        this.audit.run()
        this.poller = new Poller(this)
        this.poller.startPolling()
        this.transfer = new Transfer(this)
        this.wallet = new WalletManager(this)
    }

    // 创建账户
    newAccount() {
        return this.accounts.create()
    }

    // 获取账户列表
    getAccounts() {
        return this.accounts.getAccounts()
    }

    // 是否我的账户
    isMineAccount(address: string) {
        return this.accounts.has(address)
    }

    // 获取所有代币
    async getTokens() {
        let dao = new tokenModel.TokenDao()
        const tokens = await dao.readyTokens()
        let array: Array<string> = new Array<string>()
        for (let idx in tokens) {
            array.push(tokens[idx].symbol)
        }
        for (let idx in this.tokens) {
            array.push(this.tokens[idx].symbol)
        }
        return array
    }

    // 获取代币信息
    async getToken(symbol: string) {
        let eth: Token | null = null
        for (let idx in this.tokens) {
            const token = this.tokens[idx]
            if (token.symbol == 'ETH') {
                eth = token
            }
            if (symbol.toLowerCase() == token.symbol.toLowerCase()) {
                return token
            }
        }
        if (eth == null) {
            return null
        }

        let dao = new tokenModel.TokenDao()
        let token = await dao.get(symbol)
        if (!token || token.owner != eth.walletAddress) {
            return null
        }
        let result: Token = {
            symbol: token.symbol,
            walletAddress: eth.walletAddress,
            contractAddress: token.contract,
            decimals: token.decimals,
            privateKey: eth.privateKey,
            notify: eth.notify,
        }
        this.tokens.push(result)
        return result
    }

    // 获取智能合约
    async getContract(symbol: string) {
        if (this.contracts.has(symbol)) {
            return this.contracts.get(symbol) as Contract
        }
        let token = await this.getToken(symbol)
        if (token == null) {
            throw new Error('token not found')
        }
        let contract = new this.web3.eth.Contract(ABI, token.contractAddress)
        this.contracts.set(token.symbol, contract)
        return contract
    }

    // 获取账户余额
    async getBalance(address: string, symbol: string) {
        if (symbol.toUpperCase() == 'ETH') {
            let balance = await this.web3.eth.getBalance(address, 'latest')
            return this.web3.utils.fromWei(balance)
        }

        let token = await this.getToken(symbol)
        if (token == null) {
            throw new Error('token not found')
        }
        let contract = await this.getContract(symbol)
        if (contract == null) {
            throw new Error('contract not found')
        }

        let decimals = await this.getTokenDecimals(symbol)
        let balance = await contract.methods.balanceOf(address).call()
        return fromWei(balance, decimals)
    }

    // 获取代币精度
    async getTokenDecimals(symbol: string) {
        let token = await this.getToken(symbol)
        if (!token) {
            throw new Error('token not found')
        }
        if (token.decimals) {
            return token.decimals
        }

        let contract = await this.getContract(token.symbol)
        if (!contract) {
            throw new Error('token not found')
        }

        let decimals = await nothrow(contract.methods.decimals().call())
        if (decimals.data == null || decimals.error) {
            throw decimals.error
        }
        token.decimals = parseInt(decimals.data as string)
        return token.decimals
    }

    // 根据合约获取代币信息
    async getTokenByContract(address: string) {
        let eth: Token | null = null
        for (let idx in this.tokens) {
            const token = this.tokens[idx]
            if (token.symbol == 'ETH') {
                eth = token
            }
            if (!token.contractAddress) {
                continue
            }
            if (address.toLowerCase() == token.contractAddress.toLowerCase()) {
                return token
            }
        }
        if (eth == null) {
            return null
        }
        
        let dao = new tokenModel.TokenDao()
        let token = await dao.getByAddress(address)
        if (!token || token.owner != eth.walletAddress) {
            return null
        }
        let result: Token = {
            symbol: token.symbol,
            walletAddress: eth.walletAddress,
            contractAddress: token.contract,
            decimals: token.decimals,
            privateKey: eth.privateKey,
            notify: eth.notify,
        }
        this.tokens.push(result)
        return result
    }

    // 重新发送交易
    async resendTransaction(hash: string) {
        let dao = new TransactionDao()
        let tx = await dao.getByHash(hash)
        if (!tx) {
            throw new Error('transcation not found')
        }

        let {ok, key} = this.accounts.getPriveteKey(tx.address)
        if (!ok) {
            for (let idx in this.tokens) {
                const token = this.tokens[idx]
                if (token.walletAddress == tx.address) {
                    key = token.privateKey
                    break
                }
            }
        }

        if (!key) {
            throw new Error('transcation not found')
        }
        return await this.transfer.resend(tx.address, key, hash)
    }

    // 发送代币
    async sendToken(to: string, amount: string) {
        let token = await this.getToken('ETH')
        if (token == null) {
            throw new Error('invalid token symbol')
        }
        return await this.sendTokenFrom(token.walletAddress, to, amount, token.privateKey)
    }

    async sendTokenFrom(from: string, to: string, amount: string, privateKey: Buffer | undefined) {
        if (!privateKey) {
            let {ok, key} = this.accounts.getPriveteKey(from)
            if (!ok || !key) {
                throw new Error('account not authorized')
            }
            privateKey = key
        }
        return await this.transfer.sendToken(from, to, amount, privateKey as Buffer)
    }

    // 发送ERC20代币
    async sendERC20Token(symbol: string, to: string, amount: string) {
        let token = await this.getToken(symbol)
        if (token == null) {
            throw new Error('invalid token symbol')
        }
        return await this.sendERC20TokenFrom(symbol, token.walletAddress, to, amount, token.privateKey)
    }

    async sendERC20TokenFrom(symbol: string, from: string, to: string, amount: string, privateKey: Buffer | undefined) {
        if (!privateKey) {
            let {ok, key} = this.accounts.getPriveteKey(from)
            if (!ok || !key) {
                throw new Error('account not authorized')
            }
            privateKey = key
        }
        return await this.transfer.sendERC20Token(from, to, symbol, amount, privateKey as Buffer)
    }

    // 部署ERC20代币
    async deployERC20Token(owner: string | null | undefined, initialAmount: string, name: string, decimals: number, symbol: string) {
        let token = await this.getToken('ETH')
        if (token == null) {
            throw new Error('token not found')
        }

        if (!owner) {
            owner = token.walletAddress
        }
        if (await this.getToken(symbol) != null) {
            throw new Error('token already exists')
        }

        const wei = toWei(initialAmount, decimals)
        let data = this.eip20.deploy(owner, wei, name, decimals, symbol)
        let result = await this.transfer.sendTransaction(token.walletAddress, token.privateKey, undefined, undefined, data)

        if (owner == token.walletAddress) {
            let record = new tokenModel.Token()
            record.owner = owner
            record.initialAmount = initialAmount
            record.name = name
            record.symbol = symbol
            record.decimals = decimals
            record.hash = result.hash
            record.status = 0
            await record.save()
        }
        return result.hash
    }

    // 解析token信息
    private parseToekns(tokens: Array<any>) {
        let dict = new Map<string, any>()
        let result = new Array<Token>()
        for (let idx in tokens) {
            const token = tokens[idx]
            if (dict.has(token.keystore)) {
                let data = dict.get(token.keystore)
                result.push({
                    symbol: token.symbol,
                    walletAddress: data.address,
                    contractAddress: token.contract,
                    decimals: undefined,
                    privateKey: data.privateKey,
                    notify: token.notify
                })
                continue
            }

            const {privateKey, address} = readPrivateKey(token.keystore, token.unlockPassword)
            dict.set(token.keystore, {privateKey, address})
            result.push({
                symbol: token.symbol,
                walletAddress: address,
                contractAddress: token.contract,
                decimals: undefined,
                privateKey: privateKey,
                notify: token.notify
            })
        }
        return result
    }
}

export { Ether, Token }
