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
    this.post = function(urls) {
        if (!urls) {
            return;
        }
        if (!urls instanceof Array) {
            urls = [urls];
        }

        this.type = 'transaction';
        let data = JSON.stringify(this);
        for (let idx = 0; idx < urls.length; idx++) {
            let options = {
                url:    urls[idx],
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
    }
};

module.exports = Notify;
