# etherd
etherd 提供以太坊代币(包括ERC20代币)转账、收款通知功能以及发行代币等功能。您可以使用它轻松地将以太坊上的代币接入到自己的系统里面。另外还提供了JSON RPC API转发功能，可以直接调用ethereum 节点支持的JSON RPC API。

> 测试环境：node.js v8.10.0

## 1. 快速开始
```
git clone https://github.com/zhangpanyi/etherd.git
cd etherd
npm install
node index.js
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
        notify: 'http:/127.0.0.1/webhooks/eth'                      // 收款通知地址
    },
    BOKKY: {
        keystore: 'config/test.keystore',                               // 钱包路径
        unlockPassword: '123456',                                       // 钱包解锁密码
        contractAddress: '0x583cbBb8a8443B38aBcC0c956beCe47340ea1367',  // 代币合约地址
        notify: 'http://127.0.0.1/webhooks/bokky'                   // 收款通知地址
    }
}
```

## 3. 扩展接口

### 1. 创建账号

**请求参数说明** 

方法名称: `ext_newAccount`

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string  |账号地址  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_newAccount",
    "params": []
}

// 返回结果
{"id":"1","result":"0x3d161da7ec10116ffb61a944775ee546fa61a82f"}
```

### 2. 获取账号列表

**请求参数说明** 

方法名称: `ext_getAccounts`

**返回参数说明** 

|类型|说明|
|:-----|----- |
|array of string  |账号列表  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_getAccounts",
    "params": []
}

// 返回结果
{"id":"1","result":["0x9d01c6ca1113ce64438d6aad1e67c4e22b708fad","0xae381a76fd1fcb52476efa1034f5309bf5f6e034","0x6a4897cf6980295c3e886af78f0c25ba5ec0822d","0xced0e6f8ad1e43bba8952c0c4ea721fe6ff52cd2","0x2073a02d4407e28e169a1ba858c806991a45f8d8","0x35dde9d0c0f20a224eddfa7b564f51d2a96fd395","0x9d607976f99b9154d9912a02be5ebeb9bcf2de7a","0xdde7d28d6636a8037dd347af7a02ccfa8ca76361","0x46c6616115608512b73f557d9df7c2d2f1c6bbc2","0xbbcb86cbc24e0dfa01c80f1c62bf66b3c9ada33c","0x3d161da7ec10116ffb61a944775ee546fa61a82f"]}
```

### 3. 获取余额

**请求参数说明** 

方法名称: `ext_getBalance`

|参数名|类型|说明|
|:-----  |:-----|----- |
|address |string   |账户地址  |
|symbol |string   |代币符号 |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |余额  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_getBalance",
    "params": ["0xc299ac73687fa17e10a206c47dc0e81b8c7828e6", "ETH"]
}

// 返回结果
{"id":1,"result":"0.23"}
```

### 4. 发送ETH代币

**请求参数说明** 

方法名称: `ext_sendToken`

|参数名|类型|说明|
|:-----  |:-----|----- |
|to |string   |对方地址  |
|amount |string   |转账金额  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_sendToken",
    "params": ["0xc299ac73687fa17e10a206c47dc0e81b8c7828e6", "0.1"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 5. 发送ERC20代币

**请求参数说明** 

方法名称: `ext_sendERC20Token`

|参数名|类型|说明|
|:-----  |:-----|----- |
|symbol |string   |代币符号  |
|to |string   |对方地址  |
|amount |string   |转账金额  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_sendERC20Token",
    "params": ["BOKKY", "0xc299ac73687fa17e10a206c47dc0e81b8c7828e6", "0.1"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 6. 获取钱包余额

**请求参数说明** 

方法名称: `ext_getWalletBalance`

|参数名|类型|说明|
|:-----  |:-----|----- |
|symbol |string   | 代币符号  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|array   |地址代币余额  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_getWalletBalance",
    "params": []
}

// 返回结果
{"id":"1","result":[{"address":"0x5eebc1ca9918b2e23ec2f7f9353be24f2550b395","balance":"0"},{"address":"0xd6f366cbac08cfb985effd36dd899bc69b0c45b6","balance":"0"}]}
```

### 7. 获取主钱包地址

**请求参数说明** 

方法名称: `ext_getMainAddress`

|参数名|类型|说明|
|:-----  |:-----|----- |
|symbol |string   |代币符号  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_getMainAddress",
    "params": ["ETH"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 8. 从指定地址发送ETH代币

**请求参数说明** 

方法名称: `ext_sendTokenFrom`

|参数名|类型|说明|
|:-----  |:-----|----- |
|from | strimg |来源地址 |
|to |string   |对方地址  |
|amount |string   |转账金额  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_sendTokenFrom",
    "params": ["0x6e54b67bfeb09b35be20049cf9460cc4db9cbf2c", "0xc299ac73687fa17e10a206c47dc0e81b8c7828e6", "0.1"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 9. 从指定地址发送ERC20代币

**请求参数说明** 

方法名称: `ext_sendERC20TokenFrom`

|参数名|类型|说明|
|:-----  |:-----|----- |
|symbol |string   |代币符号  |
|from | strimg |来源地址 |
|to |string   |对方地址  |
|amount |string   |转账金额  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "ext_sendERC20TokenFrom",
    "params": ["BOKKY", "0x6e54b67bfeb09b35be20049cf9460cc4db9cbf2c", "0xc299ac73687fa17e10a206c47dc0e81b8c7828e6", "0.1"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 10. 发行ERC20代币

**请求参数说明** 

方法名称: `ext_deployToken`

|参数名|类型|说明|
|:-----  |:-----|----- |
|owner |string   |发行者地址  |
|initialAmount | integer |初始金额 |
|name |string   |代币名称  |
|decimals |integer   |代币精度  |
|symbol |string   |代币符号  |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "id": "1",
    "jsonrpc": "2.0",
    "method": "ext_deployToken",
    "params": ["0x50f6f28e6083a411fca08ef0344f3781822a54c7", "200000000", "BNT Token", 18, "BNT"]
}

// 返回结果
{"id":1,"result":"0xa353c3886ee17b2beccca21037c14c227a77f6b51bed00fa7cfe1c664a08fa4e"}
```

### 11. 重新发送交易

**请求参数说明** 

方法名称: `ext_resend`

|参数名|类型|说明|
|:-----  |:-----|----- |
|address |string   |地址  |
|txid | string |交易ID |

**返回参数说明** 

|类型|说明|
|:-----|----- |
|string   |txid  |

**示例代码**

```
// 请求示例
{
    "id": "1",
    "jsonrpc": "2.0",
    "method": "ext_resend",
    "params": ["0xb49446a6379412222330b7739149b70b1abf113d", "0x00a71ab350553bb4e8c3b1929f620134c4b1c399264ec4e02fbf89fcfef703e9"]
}

// 返回结果
{"id":"1","result":"0x87ef5c5757f087b482ec1ac0f5271e71a19d116ca2929addf6bc37845f899086"}
```