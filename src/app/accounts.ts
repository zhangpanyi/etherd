const keythereum = require("keythereum")
import { existsSync, mkdirSync, readdirSync } from 'fs'
import * as serverConfig from '@configs/server.json'

// 账户管理类
class Accounts {
    private accounts: Set<string>
    private dir =  serverConfig.datadir + '/keystore'

    constructor() {
        this.accounts = new Set()
        if (!existsSync(this.dir)) {
            mkdirSync(this.dir, {recursive: true})
        }
        this.loadAccounts()
    }

    // 创建账号
    create() {
        const params = {keyBytes: 32, ivBytes: 16}
        const keyObject = this.exportKeystore(keythereum.create(params))
        const address = '0x' + keyObject.address.toLowerCase()
        this.accounts.add(address)
        return address
    }

    // 是否存在
    has(address: string) {
        return this.accounts.has(address.toLowerCase())
    }

    // 获取账户列表
    getAccounts() {
        let accounts = new Array<string>()
        this.accounts.forEach(
            (address: string) => accounts.push(address))
        return accounts
    }

    // 载入账户列表
    loadAccounts() {
        let self = this
        const files = readdirSync(this.dir)
        files.forEach(function(filename: string) {
            const slice = filename.split('--')
            if (slice.length !== 3) {
                return
            }
            const address = '0x' + slice[2].toLowerCase()
            if (address.length == 42) {
                self.accounts.add(address)
            }
        })
    }

    // 获取账户私钥
    getPriveteKey(address: string) {
        address = address.toLowerCase()
        if (!this.accounts.has(address)) {
            return {ok: false, key: undefined}
        }
        try {
            const keyObject = keythereum.importFromFile(address, serverConfig.datadir)
            return {ok: true, key: keythereum.recover('', keyObject)}
        } catch (error) {
            return {ok: false, key: undefined}
        }
    }

    // 导出Keystore
    private exportKeystore(dk: any) {
        const options = {
            kdf: 'pbkdf2',
            cipher: 'aes-128-ctr',
            kdfparams: {
                c: 262144,
                dklen: 32,
                prf: 'hmac-sha256'
            }
        }
        const keyObject = keythereum.dump('', dk.privateKey, dk.salt, dk.iv, options)
        keythereum.exportToFile(keyObject, this.dir)
        return keyObject
    }
}

export { Accounts }
