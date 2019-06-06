const request = require('request');
const rpc = require('node-json-rpc2');
const geth = require('../../config/geth');
const logger = require('../logger');
const server = require('../../config/server');

class RPCServer {
    constructor(ethereum){
        this._server = new rpc.Server(server);

        const newaccount = require('./handlers/newaccount');
        this._server.addMethod('ext_newAccount', function(req, callback) {
            newaccount(ethereum, req, callback);
        });

        const getaccounts = require('./handlers/getaccounts');
        this._server.addMethod('ext_getAccounts', function(req, callback) {
            getaccounts(ethereum, req, callback);
        });

        const getbalance = require('./handlers/getbalance');
        this._server.addMethod('ext_getBalance', function(req, callback) {
            getbalance(ethereum, req, callback);
        });

        const getwalletbalance = require('./handlers/getwalletbalance');
        this._server.addMethod('ext_getWalletBalance', function(req, callback) {
            getwalletbalance(ethereum, req, callback);
        });

        const sendtoken = require('./handlers/sendtoken');
        this._server.addMethod('ext_sendToken', function(req, callback) {
            sendtoken(ethereum, req, callback);
        });

        const sendtokenfrom = require('./handlers/sendtokenfrom');
        this._server.addMethod('ext_sendTokenFrom', function(req, callback) {
            sendtokenfrom(ethereum, req, callback);
        });

        const senderc20token = require('./handlers/senderc20token');
        this._server.addMethod('ext_sendERC20Token', function(req, callback) {
            senderc20token(ethereum, req, callback);
        });

        const senderc20tokenfrom = require('./handlers/senderc20tokenfrom');
        this._server.addMethod('ext_sendERC20TokenFrom', function(req, callback) {
            senderc20tokenfrom(ethereum, req, callback);
        });

        const getmainaddress = require('./handlers/getmainaddress');
        this._server.addMethod('ext_getMainAddress', function(req, callback) {
            getmainaddress(ethereum, req, callback);
        });

        const deploytoken = require('./handlers/deploytoken');
        this._server.addMethod('ext_deployToken', function(req, callback) {
            deploytoken(ethereum, req, callback);
        });

        let Eth = require('web3-eth');
        this._addWeb3Methods(new Eth());
    }

    start() {
        this._server.start(function (error) {
            if (error) {
                throw error;
            } else {
                logger.info('JSON RPC server running ...');
            }
        });
    }

    async _call(req, callback) {
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
                self._call(req, callback);
            });
        }  
    }
}

module.exports = RPCServer;
