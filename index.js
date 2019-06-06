const Server = require('./config/server');
const logger = require('./app/logger');
const Ethereum = require('./app/ethereum/ethereum');
const RpcServer = require('./app/rpcserver/rpcserver');

try {
    // 启动以太坊服务
    let eth = new Ethereum();
    eth.startPoll();

    // 启动JSON-RPC服务
    let server = new RpcServer(eth, Server);
    server.start();
} catch (error) {
    logger.fatal('Service terminated, reason: %s', error.message)
}
