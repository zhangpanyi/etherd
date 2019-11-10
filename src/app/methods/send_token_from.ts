import { Validator } from "class-validator";

import { Ether } from '@app/ether';
import { logger } from '@pkg/logger';
import { nothrow } from '@pkg/promise';
import * as utils from '@app/methods/utils';

const keys = [ 'from', 'to', 'amount' ];

export async function sendTokenFrom(ether: Ether, params: any, callback: any) {
    const validator = new Validator();
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params);
    }
    if (!validator.isString(params.to)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (!validator.isString(params.from)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (!validator.isNumberString(params.amount)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    
    let result = await nothrow(ether.sendTokenFrom(
        params.from as string, params.to as string, params.amount as string, undefined));
    if (result.data == null || result.error) {
        logger.warn('failed send token, from: %s, to: %s, amount: %s, %s',
            params.from, params.to, params.amount, result.error.message);
        callback({code: -32603, message: result.error.message}, undefined);
        return;
    }
    logger.warn('send token success, from: %s, to: %s, amount: %s, hash: %s',
        params.from, params.to, params.amount, result.data);
    callback(undefined, result.data);
}
