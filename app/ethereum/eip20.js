const Web3 = require('web3');
const solc = require('solc');

class EIP20 {
    constructor(dir){
        let sources = this._readSources(dir);
        let output = solc.compile({sources: sources}, 1);
        if (output.errors) {
            throw new Error(output.errors[0]);
        }

        let web3 = new Web3();
        const contract = output.contracts['EIP20.sol:EIP20'];

        this._abi = contract.interface;
        this._bytecode = contract.bytecode;
        this._contract = new web3.eth.Contract(JSON.parse(this._abi));
    }

    // 部署合约
    deploy(owner, initialAmount, name, decimals, symbol) {
        return '0x' + this._contract.deploy({
            data:       this._bytecode,
            arguments:  [owner, initialAmount, name, decimals, symbol]
        }).encodeABI(); 
    }

    // 读取源代码
    _readSources(dir) {
        let sources = {};
        const fs = require('fs');
        const path = require('path');
        let files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            if (path.extname(filename).toLowerCase() == '.sol') {
                const fullfilename = dir + '/' + filename
                sources[filename] = fs.readFileSync(fullfilename).toString();
            }
        }
        return sources;
    }
}

module.exports = EIP20;
