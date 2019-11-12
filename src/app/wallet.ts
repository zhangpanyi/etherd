import { Ether } from '@app/ether';
import { sleep, nothrow } from '@pkg/promise';
import { logger } from '@pkg/logger';

// 代币钱包
class Wallet {
    private ether: Ether;
    private symbol: string;
    private changes: Set<string>;
    private balances: Map<string, string>;

    constructor(ether: Ether, symbol: string) {
        this.ether = ether;
        this.symbol = symbol;
        this.changes = new Set<string>();
        this.balances = new Map<string, string>();
        const accounts = this.ether.getAccounts();
        for (let idx in accounts) {
            this.changes.add(accounts[idx]);
        }
        this.startPolling();
    }

    // 获取余额
    getBalances() {
        return this.balances;
    }

    // 刷新账户余额
    refreshBalance(address: string) {
        this.changes.add(address)
    }

    // 查询账户余额
    private async startPolling() {
        while (true) {
            if (this.changes.size == 0) {
                await sleep(1000);
                continue;
            }

            for (let address of this.changes) {
                let balance = await nothrow(this.ether.getBalance(address, this.symbol));
                if (balance.data == null || balance.error != null) {
                    await sleep(1000 * 5);
                    continue;
                }
                this.changes.delete(address);
                this.balances.set(address, balance.data);
                logger.info('[wallet] balance updated, address: %s, symbol: %s, balance: %s',
                    address, this.symbol, balance.data);
            }
        }
    }
}

// 钱包管理器
class WalletManager {
    private ether: Ether;
    private wallets: Map<string, Wallet>;

    constructor(ether: Ether) {
        let self = this;
        this.ether = ether;
        this.wallets = new Map<string, Wallet>();
        (async () => {
            let symbols = await self.ether.getTokens();
            for (let idx in symbols) {
                let symbol = symbols[idx];
                if (!self.wallets.has(symbol)) {
                    self.wallets.set(symbol, new Wallet(self.ether, symbol));
                }
            }
        })()
    }

    // 获取余额
    getBalances(symbol: string) {
        if (!this.wallets.has(symbol)) {
            return new Map<string, string>();
        }
        let wallet = this.wallets.get(symbol) as Wallet;
        return wallet.getBalances();
    }

    // 刷新余额
    refreshBalance(address: string, symbol: string) {
        if (!this.wallets.has(symbol)) {
            this.wallets.set(symbol, new Wallet(this.ether, symbol));
        }
        let wallet = this.wallets.get(symbol) as Wallet;
        wallet.refreshBalance(address);
    }
}

export { WalletManager };
