import { Validator } from "class-validator"

import { Ether } from '@app/ether'
import * as utils from '@app/methods/utils'

const keys = [ 'symbol' ]

export async function getWalletBalance(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (params.symbol && !validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined)
        return
    }

    let symbol = 'ETH'
    if (params.symbol) {
        symbol = params.symbol
    }
    let result = Object.create(null)
    for (let [k, v] of ether.wallet.getBalances(symbol)) {
        result[k] = v
    }
    callback(undefined, result)
}
