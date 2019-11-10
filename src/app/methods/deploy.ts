import { Validator } from "class-validator";

import { Ether } from '@app/ether';
import { logger } from '@pkg/logger';
import { nothrow } from '@pkg/promise';
import * as utils from '@app/methods/utils';

const keys = [ 'name', 'decimals', 'symbol', 'initialAmount', 'owner' ];

export async function deployToken(ether: Ether, params: any, callback: any) {
    const validator = new Validator();
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params);
    }
    if (!validator.isString(params.name)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (!validator.isInt(params.decimals)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (!validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (!validator.isNumberString(params.initialAmount)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    if (params.owner && !validator.isString(params.owner)) {
        callback(utils.BadRequest, undefined);
        return;
    }
    
    let result = await nothrow(ether.deployERC20Token(
        params.owner as string, params.initialAmount as string,
        params.name as string, params.decimals as number, params.symbol as string));
    if (result.data == null || result.error) {
        logger.warn('failed to deploy ERC20 token , %s', result.error.message);
        callback({code: -32603, message: result.error.message}, undefined);
        return;
    }
    logger.warn('deploy ERC20 token success, symbol: %s, hash: %s', params.symbol, result.data);
    callback(undefined, result.data);
}
