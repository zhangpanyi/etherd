const request = require('request');
const rpc = require('node-json-rpc2');

const logger = require('./common/logger');

const geth = require('../config/geth');
const server = require('../config/server');

class RPCServer {
    constructor(ethereum){
        this._server = new rpc.Server(server);

        // 创建地址
        const newaccount = require('./handlers/newaccount');
        this._server.addMethod('ext_newAccount', function(req, callback) {
            newaccount(ethereum, req, callback);
        });

        // 获取地址列表
        const getaccounts = require('./handlers/getaccounts');
        this._server.addMethod('ext_getAccounts', function(req, callback) {
            getaccounts(ethereum, req, callback);
        });

        // 获取地址余额
        const getbalance = require('./handlers/getbalance');
        this._server.addMethod('ext_getBalance', function(req, callback) {
            getbalance(ethereum, req, callback);
        });

        // 获取钱包余额
        const getwalletbalance = require('./handlers/getwalletbalance');
        this._server.addMethod('ext_getWalletBalance', function(req, callback) {
            getwalletbalance(ethereum, req, callback);
        });

        // 重发交易
        const resend = require('./handlers/resend');
        this._server.addMethod('ext_resend', function(req, callback) {
            resend(ethereum, req, callback);
        });

        // 发送代币
        const sendtoken = require('./handlers/sendtoken');
        this._server.addMethod('ext_sendToken', function(req, callback) {
            sendtoken(ethereum, req, callback);
        });

        // 从指定地址发送代币
        const sendtokenfrom = require('./handlers/sendtokenfrom');
        this._server.addMethod('ext_sendTokenFrom', function(req, callback) {
            sendtokenfrom(ethereum, req, callback);
        });

        // 发送ERC20代币
        const senderc20token = require('./handlers/senderc20token');
        this._server.addMethod('ext_sendERC20Token', function(req, callback) {
            senderc20token(ethereum, req, callback);
        });

        // 从指定地址发送ERC20代币
        const senderc20tokenfrom = require('./handlers/senderc20tokenfrom');
        this._server.addMethod('ext_sendERC20TokenFrom', function(req, callback) {
            senderc20tokenfrom(ethereum, req, callback);
        });

        // 获取钱包主地址
        const getmainaddress = require('./handlers/getmainaddress');
        this._server.addMethod('ext_getMainAddress', function(req, callback) {
            getmainaddress(ethereum, req, callback);
        });

        // 部署ERC20合约
        const deploytoken = require('./handlers/deploytoken');
        this._server.addMethod('ext_deployToken', function(req, callback) {
            deploytoken(ethereum, req, callback);
        });

        const Eth = require('web3-eth');
        this._addWeb3Methods(new Eth());
    }

    // 开始服务
    start() {
        this._server.start(function (error) {
            if (error) {
                throw error;
            } else {
                logger.info('JSON RPC server running ...');
            }
        });
    }

    // 添加Web3方法
    _addWeb3Methods(methods) {
        let self = this;
        for (let key in methods) {
            let obj = methods[key];
            if (!obj || typeof(obj) == 'undefined') {
                continue;
            }

            if (Object.getPrototypeOf(obj).constructor.name != 'Function') {
                continue;
            }

            if (typeof(obj.call) != 'string') {
                continue;
            }
            logger.info('JSON RPC server add web3 method: %s', obj.call);
            this._server.addMethod(obj.call, function(req, callback) {
                self._asyncCall(req, callback);
            });
        }  
    }

    // 调用Web3 RPC
    async _asyncCall(req, callback) {
        request.post({url: geth.endpoint, json: req}, function(err, response, body) {
            if (err) {
                callback(err, undefined);
                return;
            }
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body)
                } catch (error) {
                    callback(error.message, undefined);
                    return;
                }
            }
            if (body.error) {
                callback(body.error.message, undefined);
                return;
            }
            callback(undefined, body.result);
        });
    }
}

module.exports = RPCServer;
