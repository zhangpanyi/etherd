const fs = require('fs');
const path = require('path');

let files = fs.readdirSync('configs');
for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    if (path.extname(filename).toLowerCase() == '.example') {
        const fullfilename = 'configs' + '/' + filename;
        const outfilename = 'configs' + '/' + filename.slice(0, filename.lastIndexOf('.'));
        fs.copyFileSync(fullfilename, outfilename);
    }
}