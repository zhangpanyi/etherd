Tokens = {
    ETH: {
        keystore: 'config/wallettest.keystore',
        unlockPassword: '123456',
        notify: 'http://other-server/webhooks/eth'
    },
    ERC: {
        keystore: 'config/wallettest.keystore',
        unlockPassword: '123456',
        contractAddress: '0x1c84491d87c325762a79ba1aee0b8e03c8777102',
        notify: 'http://other-server/webhooks/erc'
    }
}

module.exports = Tokens;
