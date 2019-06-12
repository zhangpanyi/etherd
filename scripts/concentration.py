#!/usr/bin/env python
# coding: utf-8
# pip install requests
# pip install prettytable

import json
import time
import logging
import argparse
import requests
import traceback
from decimal import Decimal
from prettytable import PrettyTable
from requests.auth import HTTPBasicAuth

# 解析命令行
parser = argparse.ArgumentParser()
parser.add_argument('-s', '--url', type=str, help='etherd rpc url', default='http://127.0.0.1:8545')
parser.add_argument('-u', '--user', type=str, help='etherd rpc user', default='username')
parser.add_argument('-p', '--password', type=str, help='etherd rpc password', default='password')
parser.add_argument('-f', '--fee', type=str, help='fee budget', default='0.0084')
parser.add_argument('-m', '--min', type=str, help='min balance', default='0.0084')
parser.add_argument('-t', '--token', type=str, help='token symbol', default='ETH')
args = parser.parse_args()
RPC_URL = args.url
RPC_USERNAME = args.user
RPC_PASSWORD = args.password
TOKEN_SYMBOL = args.token
MIN_TRANSFER_FEE = Decimal('0.0084')
MIN_TOKEN_BALANCE = Decimal(args.min)

fmt = '%(asctime)s %(filename)s[line:%(lineno)d] %(levelname)s %(message)s'
logging.basicConfig(format=fmt)

class JSONRPCClient(object):
    ''' JSON RPC客户端
    '''
    def __init__(self, url, username, password):
        self.url = url
        self._auth = HTTPBasicAuth(username, password)

 
    def __getattr__(self, name):
        def method(*args, **kwargs):
            req = {
                'id': 1,
                'jsonrpc': "2.0",
                'method': name,
                'params': args,
            }
            response = requests.post(self.url, auth=self._auth, data=json.dumps(req))
            result = response.json()
            if not result.get('error', None) is None:
                raise RuntimeError(result['error']['message'])
            return result['result']
        return method

class InsufficientFunds(RuntimeError):
    ''' 资金不足异常
    '''
    pass

def get_addresses_by_balance(client, min):
    ''' 根据余额获取地址
    '''
    addresses = []
    for item in client.ext_getWalletBalance(TOKEN_SYMBOL):
        if Decimal(item['balance']) >= min:
            if TOKEN_SYMBOL == 'ETH':
                addresses.append({
                    'address':  item['address'],
                    'eth':      Decimal(item['balance']),
                    'balance':  Decimal(item['balance']),
                })
            else:
                balance = client.ext_getBalance(item['address'], 'ETH')
                addresses.append({
                    'address':  item['address'],
                    'eth':      Decimal(balance),
                    'balance':  Decimal(item['balance']),
                })
    return addresses

def token_concentration(client, addresses, to):
    ''' 执行归集Token
    '''
    txs = {}
    lack_of_gas = []
    for item in addresses:
        address = item['address']
        eth     = item['eth']
        balance = item['balance']
        if eth > MIN_TRANSFER_FEE and balance > MIN_TOKEN_BALANCE:
            try:
                txid = None
                if TOKEN_SYMBOL == 'ETH':
                    amount = balance - MIN_TRANSFER_FEE
                    txid = client.ext_sendTokenFrom(address, to, str(amount))
                else:
                    txid = client.ext_sendERC20TokenFrom(TOKEN_SYMBOL, address, to, str(balance))
                txs[address] = txid
            except Exception as e:
                logging.warn('Failed to send token, %s', str(e))
        else:
            if balance > MIN_TOKEN_BALANCE:
                lack_of_gas.append(address)
    return txs, lack_of_gas

def send_fee_to(client, feesum, toaddresses):
    ''' 发送手续费
    '''
    txs = {}
    addresses = []
    for address in toaddresses:
        if feesum-MIN_TRANSFER_FEE*2 > Decimal('0'):
            try:
                txid = client.ext_sendToken(address, str(MIN_TRANSFER_FEE))
                txs[address] = txid
                addresses.append(address)
            except Exception as e:
                logging.warn('Failed to send gas, %s', str(e))
            feesum -= MIN_TRANSFER_FEE*2
        else:
            break
    return (txs, list(set(toaddresses)-set(addresses)))

def wait_until_transaction_done(client, txs):
    ''' 等待交易完成
    '''
    print('Waiting transfer confirm...')
    while True:
        done = True
        for address in txs:
            txid = txs[address]
            rawtx = client.eth_getTransactionByHash(txid)
            if rawtx['blockNumber'] is None:
                done = False
                break
        if done == True:
            break
        time.sleep(5)

def darw_statuses(client, fromaddresses, txdict):
    ''' 绘制状态表
    '''
    table = PrettyTable(['id', 'address', 'eth', 'token', 'txid', 'type', 'status'])
    table.padding_width = 4
    table.align['id'] = '1'
    for i, fromaddress in enumerate(fromaddresses):
        txid    = 'NULL'
        txtype  = 'NULL'
        status  = 'NULL'
        eth     = fromaddress['eth']
        address = fromaddress['address']
        balance = fromaddress['balance']
        txs = txdict.get(address, 'NULL')
        if not txs == 'NULL':
            for tx in txs:
                txid = tx['txid']
                txtype = tx['type']
                rawtx = client.eth_getTransactionByHash(txid)
                if not rawtx['blockNumber'] is None:
                    status = 'Done'
                else:
                    status = 'Wait'
                table.add_row([i+1, address, eth, balance, txid, txtype, status])
            continue
        table.add_row([i+1, address, eth, balance, txid, txtype, status])
    return table

def main():
    # JSONRPC客户端
    client = JSONRPCClient(
        RPC_URL, RPC_USERNAME, RPC_PASSWORD)

    # 拥有余额地址列表
    txdict = {}
    main_address = client.ext_getMainAddress('ETH')
    addresses = get_addresses_by_balance(client, MIN_TOKEN_BALANCE)

    # 获取热钱包余额
    eth = Decimal(client.ext_getBalance(main_address, 'ETH'))
    print('ETH HotWallet: {0}'.format(main_address))
    print('ETH HotWallet balance: {0}'.format(eth))
    if not TOKEN_SYMBOL == 'ETH':
        main_address = client.ext_getMainAddress(TOKEN_SYMBOL)
        erc20 = Decimal(client.ext_getBalance(main_address, TOKEN_SYMBOL))
        print('{0} HotWallet: {1}'.format(TOKEN_SYMBOL, main_address))
        print('{0} HotWallet balance: {1}'.format(TOKEN_SYMBOL, erc20))
    print(darw_statuses(client, addresses, txdict))

    # 执行Token归集操作
    print('{0} concentration...'.format(TOKEN_SYMBOL))
    txs, lack_of_gas = token_concentration(client, addresses, main_address)
    for address in txs.keys():
        txid = txs[address]
        vec = txdict.get(address, [])
        vec.append({'txid': txid, 'type': '{0} Concentration'.format(TOKEN_SYMBOL)})
        txdict[address] = vec
    print(darw_statuses(client, addresses, txdict))

    # 等待归集转账完成
    if len(txs) > 0:
        wait_until_transaction_done(client, txs)
        print(darw_statuses(client, addresses, txdict))
        txs = {}

    # 发送转账手续费
    if not TOKEN_SYMBOL == 'ETH' and len(lack_of_gas) > 0:
        print('Transfer GAS to addresses...')
        try:
            (txs, uncompleted) = send_fee_to(client, eth, lack_of_gas)
            logging.warn('Uncompleted receive GAS addresses: %s', uncompleted)
            for address in txs:
                vec = txdict.get(address, [])
                vec.append({'txid': txs[address], 'type': 'Receive GAS'})
                txdict[address] = vec
            print(darw_statuses(client, addresses, txdict))
        except InsufficientFunds:
            logging.error('Failed to send gas, insufficient funds')

    # 等待手续费到账
    if len(txs) > 0:
        wait_until_transaction_done(client, txs)
        print(darw_statuses(client, addresses, txdict))
        txs = {}

    # 再次执行归集操作
    if not TOKEN_SYMBOL == 'ETH':
        print('{0} second concentration...'.format(TOKEN_SYMBOL))
        addresses = get_addresses_by_balance(client, MIN_TOKEN_BALANCE)
        txs, _ = token_concentration(client, addresses, main_address)
        for address in txs.keys():
            txid = txs[address]
            vec = txdict.get(address, [])
            vec.append({'txid': txid, 'type': '{0} Concentration'.format(TOKEN_SYMBOL)})
            txdict[address] = vec
        print(darw_statuses(client, addresses, txdict))

    # 等待归集转账到账
    if len(txs) > 0:
        wait_until_transaction_done(client, txs)
        print(darw_statuses(client, addresses, txdict))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        traceback.print_exc()