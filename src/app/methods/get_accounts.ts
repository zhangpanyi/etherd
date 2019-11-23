import { Ether } from '@app/ether'

export async function getAccounts(ether: Ether, params: any, callback: any) {
    callback(undefined, ether.getAccounts())
}
