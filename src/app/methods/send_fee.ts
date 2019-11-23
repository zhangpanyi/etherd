import { Validator } from "class-validator"

import { Ether } from '@app/ether'
import { nothrow } from '@pkg/promise'
import * as utils from '@app/methods/utils'

const keys = [ 'symbol', 'minAmount' ]

export async function sendFee(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (!validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined)
        return
    }
    if (!validator.isNumberString(params.minAmount)) {
        callback(utils.BadRequest, undefined)
        return
    }
}