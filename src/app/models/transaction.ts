import {Entity, PrimaryGeneratedColumn, FindManyOptions, Column, BaseEntity, Index } from "typeorm"

@Entity()
@Index(['address'])
@Index(['hash'], { unique: true })
@Index(['address', 'hash'], { unique: true })
@Index(['address', 'nonce'], { unique: true })
class Transaction extends BaseEntity {
    @PrimaryGeneratedColumn("increment")
    id: number | undefined

    @Column()
    address: string = ''

    @Column()
    hash: string = ''

    @Column()
    nonce: number = 0

    @Column()
    data: string = ''
}

class TransactionDao {
    async get(address: string, hash: string) {
        return await Transaction.findOne({address, hash})
    }

    async getByHash(hash: string) {
        return await Transaction.findOne({hash})
    }

    async top(address: string, offset: number, limit: number) {
        const options: FindManyOptions = {
            where: {address},
            order: {nonce: "DESC"},
            skip: offset,
            take: limit
        }
        return await Transaction.find(options)
    }

    async insert(address: string, hash: string, tx: any) {
        let record = new Transaction()
        record.address = address
        record.hash = hash
        record.nonce = tx.nonce
        record.data = JSON.stringify(tx)
        return await Transaction.save(record)
    }

    async deleteByHash(address: string, hash: string) {
        return await Transaction.delete({address, hash})
    }

    async deleteByNonce(address: string, nonce: number) {
        return await Transaction.delete({address, nonce})
    }
}

export { Transaction, TransactionDao }
