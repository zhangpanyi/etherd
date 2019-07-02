# etherd
etherd 提供以太坊代币(包括ERC20代币)转账、收款通知功能以及发行代币等功能。你可以使用 [JSON-RPC2 API](docs/api.md) 轻松地将以太坊上的代币接入到自己的系统里面。另外还提供了以太坊节点的 [JSON-RPC API](https://github.com/ethereum/wiki/wiki/JSON-RPC) 转发功能，可以直接调用节点支持的 [JSON RPC API](https://github.com/ethereum/wiki/wiki/JSON-RPC)。

> 测试环境：node.js v8.10.0

## 1. 快速开始
```
git clone https://github.com/zhangpanyi/etherd.git
cd etherd
npm install && npm start
```

## 2. 配置文件
由于工程中只有配置模板，第一次启动服务前必须执行 `node init_config.js` 命令，用于自动生成配置文件，然后酌情修改。

`config/server.js` JSON-RPC服务配置，可自定义以下选项：
```
{
    host: '0.0.0.0',                // 绑定地址
    port: 18545,                    // 端口号
    auth: {                         // 认证信息
        users: [                    // 用户列表
            {
                login: "username",  // 用户名
                hash: "password"    // 密码
            }
        ]
    }
```

`config/tokens.js` Token配置文件，用于配置ETH和ERC20 Token钱包信息。
```
{
    ETH: {
        keystore: 'config/test.keystore',                               // 钱包路径
        unlockPassword: '123456',                                       // 钱包解锁密码
        notify: 'http:/127.0.0.1/webhooks/eth'                          // 收款通知地址
    },
    BOKKY: {
        keystore: 'config/test.keystore',                               // 钱包路径
        unlockPassword: '123456',                                       // 钱包解锁密码
        contractAddress: '0x583cbBb8a8443B38aBcC0c956beCe47340ea1367',  // 代币合约地址
        notify: 'http://127.0.0.1/webhooks/bokky'                       // 收款通知地址
    }
}
```

## 3. 问题和解决思路

### 1. 充值监控
交易所通常需要给每个用户都生成一个以太坊地址，然后再通过地址判断充值者的身份信息。etherd 使用了轮询区块的方式来获取链上 Transactions，筛选出交易所地址相关的 Transaction 后再使用 HTTP POST 的方式通知交易所服务。

使用轮询区块的方式可以保证服务停止再重启后不丢失中间产生的 Transaction 信息，因为每次轮询后当前使用的 Block Height 都会保存到文件然后再 +1，当服务重启后会根据最后记录的 Block Height 继续往下轮询。

另外 etherd 还处理掉了链上 ETH TOKEN 转账和 ERC20 TOKEN 转账之间的差异，使得推送给第三方应用的通知消息格式一致:
```
{
  "symbol": "ETH",
  "from": "0x0000000000000000000000000000000000000000",
  "to": "0x0000000000000000000000000000000000000000",
  "hash": "0x2357d59529140df538af447c3d638efa6c606025ad13ed8c171a0e801519a3e8",
  "amount": "0",
  "blockNumber": 0
}
```

### 2. nonce生成
以太坊要求一个地址的每笔 Transaction 有一个唯一且连续的 nonce，每个节点将根据 nonce 顺序严格执行来自一个地址的 Transaction。所以发送 Transaction 时不能设置相同的nonce，并且要保证 nonce 是连续的，否则将会导致不符合预期的结果。

网上的方案通常是使用 [web3.eth.getTransactionCount(address, "pending")](https://web3js.readthedocs.io/en/1.0/web3-eth.html#gettransactioncount) 接口获取 nonce  值，但是在实际使用中**并不可靠**，经常会出现问题。etherd 使用以下方式提供相对可靠的 nonce 生成方案，经长期测试几乎没有出现过问题。
1. 发送 transaction 时本地累加 nonce，并将每笔 transaction  的 `txid` 和 `nonce` 信息顺序保存到内存和文件。
2. 轮询已经发出的 transaction，如果已被打包进区块则将这笔 transaction 从内存和文件中删除。
3. 如果发现超时(自定义时间)未完成的 transaction 则发出警告并手动处理：设置相同的 nonce 再将 transaction 重发一次。否则后续产生的 transaction 将无法打包。
4. 启动服务时调用 `web3.eth.getTransactionCount(address, "latest")` 获取 count，然后对比保存到文件中的最大 nonce 值，取两者中值最大的作为下一笔 transaction 的 nonce 值。

### 3. GAS价格计算
web3.js 提供了 [web3.eth.getGasPrice()](https://web3js.readthedocs.io/en/1.0/web3-eth.html#getgasprice) 接口用于获取 GAS 的价格。但有一次创建 transaction 的时候给了一个较低的 GAS 价格，导致这个 transaction 迟迟不被打包进区块，并且影响到了后续创建的 transactions。所以 etherd 自定义了 GAS 价格的计算方式:
```
gasPrice = max(min(最新区块平均价格, 最新区块中间价格), web3.eth.getGasPrice())
```