const fs = require('fs');
const ini = require('ini');

module.exports = {
    filename: 'startblock.ini',

    // 获取高度
    getHeigth : function() {
        if (!fs.existsSync(this.filename)) {
            fs.writeFileSync(this.filename, ini.stringify({}));
        }
        let config = ini.parse(fs.readFileSync(this.filename, 'utf-8'));
        return parseInt(config.height) || 0;
    },

    // 更新高度
    updateHeigth : function(heigth) {
        let config = ini.parse(fs.readFileSync(this.filename, 'utf-8'));
        config.height = heigth;
        fs.writeFileSync(this.filename, ini.stringify(config));
    }
};
