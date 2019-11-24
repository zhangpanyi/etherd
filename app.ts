import { existsSync, mkdirSync } from 'fs';

import Web3 from 'web3';
import { Ether } from '@app/ether';
import { logger } from '@pkg/logger';
import { Worker } from '@app/worker';
import { RpcServer } from '@app/server';
import { openConnect } from "@app/models/conn";

import Geth from '@configs/geth.json';
import * as serverConfig from '@configs/server.json';

(async () => {
    // 创建数据目录
    if (!existsSync(serverConfig.datadir)) {
        mkdirSync(serverConfig.datadir, {recursive: true});
    }

    // 获取网络类型
    const web3 = new Web3(new Web3.providers.HttpProvider(Geth.endpoint));
    const network = await web3.eth.net.getNetworkType();
    logger.info('ethereum network type: %s', network);

    // 打开数据连接
    await openConnect(network);

    // 开始异步作业
    let ether = new Ether(web3, network)
    let worker = new Worker(ether);
    worker.start()

    // 运行JSON-RPC2服务
    let server = new RpcServer(ether);
    server.run(serverConfig.host, serverConfig.port);
})();
