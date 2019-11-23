import { Validator } from "class-validator"

import { Ether } from '@app/ether'
import { nothrow } from '@pkg/promise'
import * as utils from '@app/methods/utils'

const keys = [ 'address', 'symbol' ]

export async function getBalance(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (!validator.isString(params.address)) {
        callback(utils.BadRequest, undefined)
        return
    }
    if (params.symbol && !validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined)
        return
    }

    let symbol = 'ETH'
    if (params.symbol) {
        symbol = params.symbol
    }
    let result = await nothrow(ether.getBalance(params.address as string, symbol))
    if (result.data == null || result.error) {
        callback({code: -32603, message: result.error.message}, undefined)
        return
    }
    callback(undefined, result.data)
}
