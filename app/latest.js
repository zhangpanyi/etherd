const fs = require('fs');
const ini = require('ini');

module.exports = {
    // 存储路径
    getPath: function() {
        if (!fs.existsSync('db')) {
            fs.mkdirSync('db');
        }
        return 'db/latest.ini';
    },

    // 获取高度
    getHeigth : function() {
        if (!fs.existsSync(this.getPath())) {
            fs.writeFileSync(this.getPath(), ini.stringify({}));
        }
        let config = ini.parse(fs.readFileSync(this.getPath(), 'utf-8'));
        return parseInt(config.height) || 0;
    },

    // 更新高度
    updateHeigth : function(heigth) {
        let config = ini.parse(fs.readFileSync(this.getPath(), 'utf-8'));
        config.height = heigth;
        fs.writeFileSync(this.getPath(), ini.stringify(config));
    }
};
