import Web3 from 'web3';
import { logger } from '@pkg/logger';
import { nothrow, sleep } from '@pkg/promise';
import { TokenDao } from '@app/models/token';

const enum Status {
    PENDING,
    OK,
    FAILED
}

class Audit {
    private web3: Web3;
    private started = false;

    constructor(web3: Web3) {
        this.web3 = web3;
    }

    // 运行审计
    async run() {
        if (this.started) {
            return;
        }
        this.started = true;

        const dao = new TokenDao();
        while (true) {
            const tokens = await dao.pendingTokens();
            for (let idx in tokens) {
                const token = tokens[idx];
                let status = await nothrow(this.checkReceipt(token.hash));
                if (status.data == null || status.error) {
                    logger.info('[audit] failed to get transaction receipt, %s', status.error.message);
                    continue;
                }

                if (status.data.status == Status.PENDING) {
                    continue;
                }

                if (status.data.status == Status.OK) {
                    await dao.updateStatus(token.hash, 1, status.data.contract);
                    logger.info('[audit] deploy success, address: %s, contract: %s, hash: %s',
                        token.owner, status.data.contract, token.hash);
                } else if (status.data.status == Status.FAILED) {
                    await dao.updateStatus(token.hash, 2, status.data.contract);
                    logger.error('[audit] deploy failure, address: %s, hash: %s', token.owner, token.hash);
                }
            }
            await sleep(1000 * 10);
        }
    }

    // 检查凭据
    async checkReceipt(hash: string) {
        let receipt = await nothrow(this.web3.eth.getTransactionReceipt(hash));
        if (receipt.data == null || receipt.error) {
            throw receipt.error;
        }

        if (!receipt.data || receipt.data.blockNumber == 0) {
            return {status: Status.PENDING};
        }
        if (!receipt.data.status) {
            return {status: Status.FAILED};
        }
        let contractAddress = '';
        if (receipt.data.contractAddress) {
            contractAddress = receipt.data.contractAddress.toLowerCase();
        }
        return {status: Status.OK, contract: contractAddress};
    }
}

export { Audit };
