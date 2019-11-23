import {Entity, PrimaryGeneratedColumn, FindManyOptions, Column, BaseEntity, Index } from "typeorm"

@Entity()
@Index(['status'])
@Index(['hash'], { unique: true })
@Index(['status', 'symbol'], { unique: true })
@Index(['status', 'contract'], { unique: true })
class Token extends BaseEntity {
    @PrimaryGeneratedColumn("increment")
    id: number | undefined

    @Column()
    owner: string = ''

    @Column()
    initialAmount: string = ''

    @Column()
    name: string = ''

    @Column()
    symbol: string = ''

    @Column()
    decimals: number = 0

    @Column()
    hash: string = ''

    @Column()
    contract: string = ''

    @Column()
    status: number = 0
}

class TokenDao {
    async get(symbol: string) {
        const options: FindManyOptions = {
            where: {status: 1, symbol}
        }
        let token = await Token.findOne(options)
        return token
    }

    async getByAddress(address: string) {
        const options: FindManyOptions = {
            where: {status: 1, contract: address}
        }
        return await Token.findOne(options)
    }

    async readyTokens() {
        const options: FindManyOptions = {
            where: {status: 1},
            order: {id: "ASC"}
        }
        return await Token.find(options)
    }

    async pendingTokens() {
        const options: FindManyOptions = {
            where: {status: 0},
            order: {id: "ASC"}
        }
        return await Token.find(options)
    }

    async updateHash(hash: string, newHash: string) {
        return await Token.getRepository().update(
            {hash: hash}, {hash: newHash, contract: '', status: 0})
    }

    async updateStatus(hash: string, status: number, contract: string | undefined) {
        return await Token.getRepository().update({hash: hash}, {status, contract})
    }

    async deleteByHash(hash: string) {
        return await Token.delete({hash})
    }
}

export { Token, TokenDao }
