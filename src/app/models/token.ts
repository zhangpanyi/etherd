import {
    BaseEntity,
    Entity,
    Column,
    PrimaryGeneratedColumn,
    FindManyOptions,
    Index
} from 'typeorm'

enum Status { Pending = 0, Done = 1, Failed = 2 }

@Entity()
@Index(['status'])
@Index(['hash'], { unique: true })
@Index(['status', 'symbol'], { unique: true })
@Index(['status', 'contract'], { unique: true })
class Token extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
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
            where: {status: Status.Done, symbol}
        }
        return await Token.findOne(options)
    }

    async getByAddress(address: string) {
        const options: FindManyOptions = {
            where: {status: Status.Done, contract: address}
        }
        return await Token.findOne(options)
    }

    async getAvailableTokens() {
        const options: FindManyOptions = {
            where: {status: Status.Done},
            order: {id: 'ASC'}
        }
        return await Token.find(options)
    }

    async pendingTokens() {
        const options: FindManyOptions = {
            where: {status: Status.Pending},
            order: {id: 'ASC'}
        }
        return await Token.find(options)
    }

    async updateHash(hash: string, newHash: string) {
        return await Token.getRepository().update(
            {hash: hash}, {hash: newHash, contract: '', status: Status.Pending})
    }

    async updateStatus(hash: string, status: number, contract: string | undefined) {
        return await Token.getRepository().update({hash: hash}, {status, contract})
    }

    async deleteByHash(hash: string) {
        return await Token.delete({hash})
    }
}

export { Token, TokenDao, Status }
