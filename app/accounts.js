const fs = require("fs"); 
const keythereum = require("keythereum");
const sleep = require('./common/sleep');
const logger = require('./common/logger');

class Accounts {
    constructor(dir){
        this.dir = dir;
        this._accounts = null;
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir);
        }
        this._loadAccounts();
    }

    // 是否存在
    has(address) {
        if (this._accounts == null) {
            return false;
        }
        return this._accounts.has(address.toLowerCase());
    }

    // 创建账号
    create() {
        const params = {keyBytes: 32, ivBytes: 16};
        const keyObject = this._exportKeystore(keythereum.create(params));
        if (this._accounts == null) {
            this._accounts = new Set([]);
        }
        const address = '0x' + keyObject.address.toLowerCase();
        this._accounts.add(address);
        return address;
    }

    // 获取私钥
    getPriveteKey(address) {
        try {
            if (this._accounts == null) {
                return [undefined, false];
            }
    
            address = address.toLowerCase()
            if (!this._accounts.has(address)) {
                return [undefined, false];
            }

            const keyObject = keythereum.importFromFile(address, '.');
            return [keythereum.recover('', keyObject), true];
        } catch (error) {
            return [undefined, false];
        }
    }

    // 获取账户列表
    getAccounts() {
        if (this._accounts == null) {
            this._accounts = new Set([]);
        }
        return this._accounts
    }

    // 加载账户列表
    _loadAccounts() {
        let accounts = new Set([]);
        const files = fs.readdirSync(this.dir);
        for (let idx in files) {
            const filename = files[idx];
            const slices = filename.split('--');
            if (slices.length == 3) {
                const address = '0x' + slices[2].toLowerCase();
                if (address.length == 42) {
                    accounts.add(address);
                }
            }
        }
        if (this._accounts == null) {
            this._accounts = new Set(accounts);
        }
        this._accounts = new Set([...this._accounts, ...accounts]);
        return true;
    }

    // 导出keystore
    _exportKeystore(dk) {
        const options = {
            kdf: 'pbkdf2',
            cipher: 'aes-128-ctr',
            kdfparams: {
                c: 262144,
                dklen: 32,
                prf: 'hmac-sha256'
            }
        };
        const keyObject = keythereum.dump('', dk.privateKey, dk.salt, dk.iv, options);
        keythereum.exportToFile(keyObject, this.dir);
        return keyObject;
    }
}

module.exports = Accounts;
