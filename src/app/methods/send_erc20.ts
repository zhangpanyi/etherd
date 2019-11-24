import { Validator } from 'class-validator'

import { Ether } from '@app/ether'
import { logger } from '@pkg/logger'
import { nothrow } from '@pkg/promise'
import * as utils from '@app/methods/utils'

const keys = [ 'symbol', 'to', 'amount' ]

export async function sendERC20(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (!validator.isString(params.to)) {
        callback(utils.BadRequest, undefined)
        return
    }
    if (!validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined)
        return
    }
    if (!validator.isNumberString(params.amount)) {
        callback(utils.BadRequest, undefined)
        return
    }
    
    let result = await nothrow(ether.sendERC20Token(
        params.symbol as string, params.to as string, params.amount as string))
    if (result.data == null || result.error) {
        logger.warn('failed to send ERC20 token, symbol: %s, to: %s, amount: %s, %s',
            params.symbol, params.to, params.amount, result.error.message)
        callback({code: -32603, message: result.error.message}, undefined)
        return
    }
    logger.warn('send ERC20 token success, symbol: %s, to: %s, amount: %s, hash: %s',
        params.symbol, params.to, params.amount, result.data)
    callback(undefined, result.data)
}
