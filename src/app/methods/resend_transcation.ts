import { Validator } from 'class-validator'

import { Ether } from '@app/ether'
import { nothrow } from '@pkg/promise'
import * as utils from '@app/methods/utils'

const keys = [ 'hash' ]

export async function resendTransaction(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (!validator.isString(params.hash)) {
        callback(utils.BadRequest, undefined)
        return
    }

    let result = await nothrow(ether.resendTransaction(params.hash as string))
    if (result.data == null || result.error) {
        callback({code: -32603, message: result.error.message}, undefined)
        return
    }
    callback(undefined, result.data)
}
