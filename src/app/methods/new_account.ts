import { Ether } from '@app/ether';

export async function newAccount(ether: Ether, params: any, callback: any) {
    let account = ether.newAccount();
    callback(undefined, account);
}
