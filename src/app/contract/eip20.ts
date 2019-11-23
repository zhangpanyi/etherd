import { extname } from 'path'
import { readdirSync, readFileSync } from 'fs'
import Web3 from 'web3'
import { Contract } from 'web3-eth-contract'

const solc = require('solc')

class EIP20 {
    private abi: any
    private web3: Web3
    private bytecode: any
    private contract: Contract
    
    constructor(dir: string) {
        const sources = this.readSourceFiles(dir)
        let output = solc.compile({sources: sources}, 1)
        if (output.errors) {
            throw new Error(output.errors[0])
        }

        this.web3 = new Web3(null)
        const contract = output.contracts['EIP20.sol:EIP20']

        this.abi = contract.interface
        this.bytecode = contract.bytecode
        this.contract = new this.web3.eth.Contract(JSON.parse(this.abi))
    }

    // 部署合约
    deploy(owner: string, initialAmount: string, name: string, decimals: number, symbol: string) {
        return '0x' + this.contract.deploy({
            data:       this.bytecode,
            arguments:  [owner, initialAmount, name, decimals, symbol]
        }).encodeABI() 
    }

    // 读取源代码
    private readSourceFiles(dir: string) {
        let sources = Object.create(null)
        const files = readdirSync(dir)
        for (let idx in files) {
            const filename = files[idx]
            if (extname(filename).toLowerCase() == '.sol') {
                const fullfilename = dir + '/' + filename
                sources[filename] = readFileSync(fullfilename).toString()
            }
        }
        return sources
    }
}

export { EIP20 }
