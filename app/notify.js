const request = require('request');
const logger = require('./common/logger');
 
 function Notify() {
    let symbol      = '';   // 代币符号
    let from        = null; // 发送者
    let to          = null; // 接收者
    let hash        = null; // txid
    let amount      = '0';  // 转账金额
    let blockNumber = 0;    // 区块高度

    // 投递通知
    this.post = function(url) {
        if (!url) {
            return;
        }
        this.type = 'transaction';
        let data = JSON.stringify(this);
        let options = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: data
        };
        request.post(options, function (error, response, body) {
            if (error != null) {
                logger.error('Failed to post notify: %s, %s', error.message, options.json);
            }
        });
    }
};

module.exports = Notify;