import { Validator } from 'class-validator'

import { Ether } from '@app/ether'
import { ToDo, Type } from '@app/models/todo'
import * as utils from '@app/methods/utils'

const keys = [ 'symbol', 'minBalance' ]

export async function collect(ether: Ether, params: any, callback: any) {
    const validator = new Validator()
    if (validator.isArray(params)) {
        params = utils.arrayToObject(keys, params)
    }
    if (!validator.isString(params.symbol)) {
        callback(utils.BadRequest, undefined)
        return
    }
    if (!validator.isNumberString(params.minBalance)) {
        callback(utils.BadRequest, undefined)
        return
    }

    let token = await ether.getToken(params.symbol)
    if (token == null) {
        callback(utils.InvalidToken, undefined)
        return
    }

    let record = new ToDo()
    record.type = Type.Collect
    record.params = JSON.stringify({symbol: params.symbol, minBalance: params.minBalance})
    record.save()

    callback(undefined, {state: 'queued'})
}