import * as path from 'path'
import { readFileSync } from 'fs'
import { BigNumber } from 'bignumber.js'
const keythereum = require("keythereum")

export function toWei(amount: string, decimals: number) {
    let base = new BigNumber(10, 10)
    let value = new BigNumber(amount, 10)
    let wei = value.multipliedBy(base.pow(decimals))
    return wei.toFixed(0)
}

export function fromWei(amount: string, decimals: number) {
    let base = new BigNumber(10, 10)
    let value = new BigNumber(amount, 10)
    return value.div(base.pow(decimals)).toString(10)
}

export function readPrivateKey(keyStore: string, unlockPassword: string) {
    let buffer = readFileSync(path.join('.', keyStore))
    let obj = JSON.parse(buffer.toString())
    let privateKey = keythereum.recover(unlockPassword, obj)
    return {privateKey, address: '0x'+obj.address}
}