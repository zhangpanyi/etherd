import * as jayson from 'jayson';
import * as request from 'request-promise';
import { logger } from '@pkg/logger';
import { Ether } from '@app/ether';
import Geth from '@configs/geth.json';
import * as config from '@configs/server.json';

const connect = require('connect');
const jsonParser = require('body-parser').json;
const middleware = require('jayson/lib/server/middleware');

import { sendToken } from '@app/methods/send_token';
import { sendERC20 } from '@app/methods/send_erc20';
import { getBalance } from '@app/methods/get_balance';
import { newAccount } from '@app/methods/new_account';
import { deployToken } from '@app/methods/deploy';
import { getAccounts } from '@app/methods/get_accounts';
import { sendTokenFrom } from '@app/methods/send_token_from';
import { sendERC20From } from '@app/methods/send_erc20_from';
import { resendTransaction } from '@app/methods/resend';
import { nothrow } from '@pkg/promise';

export class RpcServer {
    private ether: Ether;

    constructor(ether: Ether) {
        this.ether = ether;
    }

    async run(host: string, port: number) {
        let self = this;
        let app = connect();
        const router = Object.assign(this.router(), this.forward());
        let server = new jayson.Server(router);

        app.use(jsonParser());
        app.use(function(req: any, res: any, next: any) {
            if (!self.auth(req.headers)) {
                res.writeHead(401);
                res.end();
            } else {
                middleware(server)(req, res, next);
            }
        });
        logger.info('JSON-RPC2 server started on %s:%s', host, port);
        app.listen(port, host);
    }

    private auth(headers: any) {
        const username = config.login.username;
        const password = config.login.password;
        if (username.length == 0) {
            return true;
        }
        if (password.length == 0) {
            return true;
        }
        if (!headers || !headers.authorization) {
            return false;
        }
        const authorization = String(headers.authorization);
        const slice = authorization.split(' ');
        if (slice.length != 2 || slice[0] != 'Basic') {
            return false;
        }

        const buffer = Buffer.from(slice[1], 'base64');
        const pair = buffer.toString().split(':');
        if (pair.length != 2) {
            return false;
        }
        return pair[0] == username && pair[1] == password;
    }

    private router(): {[methodName: string]: jayson.MethodLike} {
        let self = this;
        return {
            'sendToken': function(params: any, callback: any) {
                sendToken(self.ether, params, callback);
            },
            'sendERC20': function(params: any, callback: any) {
                sendERC20(self.ether, params, callback);
            },
            'getBalance': function(params: any, callback: any) {
                getBalance(self.ether, params, callback);
            },
            'newAccount': function(params: any, callback: any) {
                newAccount(self.ether, params, callback);
            },
            'deployToken': function(params: any, callback: any) {
                deployToken(self.ether, params, callback);
            },
            'getAccounts': function(params: any, callback: any) {
                getAccounts(self.ether, params, callback);
            },
            'sendTokenFrom': function(params: any, callback: any) {
                sendTokenFrom(self.ether, params, callback);
            },
            'sendERC20From': function(params: any, callback: any) {
                sendERC20From(self.ether, params, callback);
            },
            'resendTransaction': function(params: any, callback: any) {
                resendTransaction(self.ether, params, callback);
            }
        };
    }

    private forward(): {[methodName: string]: jayson.MethodLike} {
        let router = Object.create(null);
        const methods = this.ether.web3.eth as any;
        for (let key in methods) {
            let val = methods[key];
            if (!val || typeof(val) == 'undefined') {
                continue;
            }

            if (Object.getPrototypeOf(val).constructor.name != 'Function') {
                continue;
            }

            if (typeof(val.call) != 'string') {
                continue;
            }
            
            let method = val.call;
            router[val.call] = async function(params: any, callback: any) {
                const body = {
                    id: 1,
                    jsonrpc: '2.0',
                    method: method,
                    params: params
                };
                let response = await nothrow(request.post(Geth.endpoint, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }).promise());
                if (!response.error) {
                    const obj = JSON.parse(response.data);
                    if (obj.error) {
                        callback(obj.error, undefined);
                    } else {
                        callback(undefined, obj.result);
                    }
                } else {
                    callback({code: -32603, message: response.error}, undefined);
                }
            }
            logger.info('JSON RPC2 server add web3 method: %s', val.call);
        }
        return router;
    }
}
